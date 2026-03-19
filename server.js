import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  PUMP_FUN_COIN_ADDRESS: process.env.PUMP_FUN_COIN_ADDRESS || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  PORT: process.env.PORT || 3000,

  // TTS / Voice
  TTS_PROVIDER: process.env.TTS_PROVIDER || 'elevenlabs',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || '',

  // Rate Limiting
  RATE_LIMIT_PER_USER: parseInt(process.env.RATE_LIMIT_PER_USER) || 1,
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || 5) * 60 * 1000,
  GLOBAL_RATE_LIMIT: parseInt(process.env.GLOBAL_RATE_LIMIT) || 10,
  GLOBAL_RATE_WINDOW_MS: parseInt(process.env.GLOBAL_RATE_WINDOW_MINUTES || 5) * 60 * 1000,

  // Trigger prefix (case-insensitive)
  TRIGGER_PREFIX: 'jesus',

  SYSTEM_PROMPT: `You are Jesus Christ responding to questions in a cryptocurrency livestream chat. Speak with divine wisdom, compassion, and gentle authority. Keep responses brief (1-2 sentences) suitable for chat. Be profound yet accessible. Address spiritual, philosophical, or life questions with grace. For crypto-specific questions, offer wisdom about greed, faith, and community rather than financial advice. Never break character.`,
};

// ============================================================
// SIMPLE RATE LIMITER (no extra dependency)
// ============================================================
class RateLimiter {
  constructor(maxHits, windowMs) {
    this.maxHits = maxHits;
    this.windowMs = windowMs;
    this.hits = new Map(); // key -> [{timestamp}, ...]
  }

  /** Returns true if allowed, false if rate-limited */
  consume(key) {
    const now = Date.now();
    let records = this.hits.get(key) || [];
    // Prune expired
    records = records.filter(t => now - t < this.windowMs);
    if (records.length >= this.maxHits) {
      this.hits.set(key, records);
      return false;
    }
    records.push(now);
    this.hits.set(key, records);
    return true;
  }
}

const userLimiter = new RateLimiter(
  CONFIG.RATE_LIMIT_PER_USER,
  CONFIG.RATE_LIMIT_WINDOW_MS
);

const globalLimiter = new RateLimiter(
  CONFIG.GLOBAL_RATE_LIMIT,
  CONFIG.GLOBAL_RATE_WINDOW_MS
);

// ============================================================
// TRIGGER & QUESTION EXTRACTION
// ============================================================
/**
 * Checks if the message starts with "jesus " (case-insensitive).
 * Returns the question text after the prefix, or null if not triggered.
 */
function extractQuestion(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Must start with "jesus " (with a space after)
  if (!lower.startsWith(CONFIG.TRIGGER_PREFIX + ' ')) return null;

  const question = trimmed.slice(CONFIG.TRIGGER_PREFIX.length).trim();
  if (question.length < 3) return null; // Too short to be meaningful

  return question;
}

// ============================================================
// OPENAI INTEGRATION
// ============================================================
async function getJesusResponse(question, username) {
  if (!CONFIG.OPENAI_API_KEY) {
    return 'Peace be with you, child. The divine connection requires proper configuration.';
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: CONFIG.OPENAI_MODEL,
        messages: [
          { role: 'system', content: CONFIG.SYSTEM_PROMPT },
          { role: 'user', content: `${username} asks: ${question}` },
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  } catch (err) {
    console.error('[OPENAI ERROR]', err.message);
    return 'The spirit is willing, but the connection is weak. Please try again.';
  }
}

// ============================================================
// PUMP.FUN WEBSOCKET MONITOR
// ============================================================
let pumpFunWs = null;
let reconnectTimer = null;
const processedMessages = new Set();

function connectToPumpFun() {
  if (!CONFIG.PUMP_FUN_COIN_ADDRESS) {
    console.warn('[PUMP.FUN] No coin address configured. Set PUMP_FUN_COIN_ADDRESS in .env');
    return;
  }

  const wsUrl = 'wss://pumpportal.fun/api/data';
  console.log('[PUMP.FUN] Connecting to', wsUrl, '...');

  pumpFunWs = new WebSocket(wsUrl);

  pumpFunWs.on('open', () => {
    console.log('[PUMP.FUN] Connected — subscribing to coin:', CONFIG.PUMP_FUN_COIN_ADDRESS);

    // Subscribe to token trades (chat messages come through here)
    pumpFunWs.send(JSON.stringify({
      method: 'subscribeTokenTrade',
      keys: [CONFIG.PUMP_FUN_COIN_ADDRESS],
    }));
    
    // Also try subscribing to new token events
    pumpFunWs.send(JSON.stringify({
      method: 'subscribeNewToken',
      keys: [CONFIG.PUMP_FUN_COIN_ADDRESS],
    }));
    
    console.log('[PUMP.FUN] Subscriptions sent. Waiting for messages...');
  });

  pumpFunWs.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log('[PUMP.FUN] RAW MESSAGE:', JSON.stringify(msg, null, 2));
      await handlePumpFunMessage(msg);
    } catch (err) {
      console.log('[PUMP.FUN] Non-JSON message:', raw.toString().slice(0, 200));
    }
  });

  pumpFunWs.on('error', (err) => {
    console.error('[PUMP.FUN] WS error:', err.message);
  });

  pumpFunWs.on('close', () => {
    console.log('[PUMP.FUN] Disconnected. Reconnecting in 5 s...');
    reconnectTimer = setTimeout(connectToPumpFun, 5000);
  });
}

// ============================================================
// MESSAGE HANDLER
// ============================================================
async function handlePumpFunMessage(msg) {
  // Pump.fun sends various event types — we look for chat-like data.
  // The exact schema depends on their API; adjust these field names as needed.
  console.log('[HANDLER] Processing message. Available fields:', Object.keys(msg));
  
  const chatText = msg.text || msg.message || msg.comment || msg.content || '';
  const username =
    msg.user || msg.username || msg.name || msg.traderPublicKey?.slice(0, 6) || 'Anon';
  const messageId =
    msg.signature || msg.id || `${username}-${chatText}-${Date.now()}`;

  if (!chatText) {
    console.log('[HANDLER] No chat text found in message');
    return;
  }

  // Deduplicate
  if (processedMessages.has(messageId)) return;
  processedMessages.add(messageId);
  if (processedMessages.size > 2000) {
    const keep = Array.from(processedMessages).slice(-1000);
    processedMessages.clear();
    keep.forEach((id) => processedMessages.add(id));
  }

  // --- Trigger check: must start with "jesus <question>" ---
  const question = extractQuestion(chatText);
  if (!question) return;

  console.log(`[QUESTION] ${username}: ${question}`);

  // --- Generate response ---
  const response = await getJesusResponse(question, username);
  console.log(`[JESUS] → ${response}`);

  broadcastToClients({
    type: 'jesus_response',
    question,
    username,
    response,
    timestamp: Date.now(),
  });
}

// ============================================================
// FRONTEND WEBSOCKET SERVER
// ============================================================
const frontendClients = new Set();

wss.on('connection', (ws) => {
  console.log('[WS] Frontend client connected');
  frontendClients.add(ws);

  ws.send(JSON.stringify({ type: 'connected', message: 'Divine channel open' }));

  ws.on('close', () => {
    frontendClients.delete(ws);
  });
  ws.on('error', () => {
    frontendClients.delete(ws);
  });
});

function broadcastToClients(data) {
  const payload = JSON.stringify(data);
  for (const client of frontendClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// ============================================================
// CONFIG ENDPOINT FOR FRONTEND
// ============================================================
app.get('/api/config', (req, res) => {
  res.json({
    OPENAI_API_KEY: CONFIG.OPENAI_API_KEY,
    OPENAI_MODEL: CONFIG.OPENAI_MODEL,
    TTS_PROVIDER: CONFIG.TTS_PROVIDER,
    ELEVENLABS_API_KEY: CONFIG.ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID: CONFIG.ELEVENLABS_VOICE_ID,
  });
});

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json());

// ============================================================
// ADMIN PAGE
// ============================================================
app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: '.' });
});

// ============================================================
// ADMIN QUESTION ENDPOINT
// ============================================================
app.post('/api/admin-question', async (req, res) => {
  const { username, question } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'Question required' });
  }
  
  const user = username || 'Admin';
  
  console.log(`[ADMIN] Manual question from ${user}: ${question}`);
  
  // Generate response
  const response = await getJesusResponse(question, user);
  
  // Broadcast to frontend
  broadcastToClients({
    type: 'jesus_response',
    question,
    username: user,
    response,
    timestamp: Date.now(),
  });
  
  res.json({ success: true, response });
});

// ============================================================
// MANUAL TEST ENDPOINT
// ============================================================

app.post('/api/test-question', async (req, res) => {
  const { username, question } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'Question required' });
  }
  
  const user = username || 'TestUser';
  
  console.log(`[TEST] Manual question from ${user}: ${question}`);
  
  // Generate response
  const response = await getJesusResponse(question, user);
  
  // Broadcast to frontend
  broadcastToClients({
    type: 'jesus_response',
    question,
    username: user,
    response,
    timestamp: Date.now(),
  });
  
  res.json({ success: true, response });
});

// ============================================================
// STATIC FILES
// ============================================================
app.use(express.static('.'));

// ============================================================
// BOOT
// ============================================================
server.listen(CONFIG.PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Jesus Pump.fun Responder`);
  console.log(`========================================`);
  console.log(`  Server  : http://localhost:${CONFIG.PORT}`);
  console.log(`  Coin    : ${CONFIG.PUMP_FUN_COIN_ADDRESS || 'NOT SET'}`);
  console.log(`  Trigger : Messages starting with "${CONFIG.TRIGGER_PREFIX} <question>"`);
  console.log(`  User RL : ${CONFIG.RATE_LIMIT_PER_USER} / ${CONFIG.RATE_LIMIT_WINDOW_MS / 60000} min`);
  console.log(`  Global  : ${CONFIG.GLOBAL_RATE_LIMIT} / ${CONFIG.GLOBAL_RATE_WINDOW_MS / 60000} min`);
  console.log(`  OpenAI  : ${CONFIG.OPENAI_API_KEY ? 'YES' : 'NOT SET'}`);
  console.log(`========================================\n`);

  connectToPumpFun();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SERVER] Shutting down...');
  if (pumpFunWs) pumpFunWs.close();
  clearTimeout(reconnectTimer);
  server.close(() => process.exit(0));
});
