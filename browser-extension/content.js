// ============================================================
// PUMP.FUN CHAT MONITOR - Content Script
// ============================================================

console.log('[JESUS EXTENSION] Content script loaded on pump.fun');

// Track processed messages to avoid duplicates
const processedMessages = new Set();

// Configuration
const TRIGGER_PREFIX = 'jesus';
const CHECK_INTERVAL = 500; // Check for new messages every 500ms

// ============================================================
// CHAT MESSAGE DETECTION
// ============================================================

/**
 * Finds chat messages in the pump.fun DOM
 * Adjust selectors based on actual pump.fun structure
 */
function findChatMessages() {
  // Updated selectors for current pump.fun structure
  const possibleSelectors = [
    '[data-testid="chat-message"]',
    '[class*="ChatMessage"]',
    '[class*="chat-message"]',
    '[class*="message-item"]',
    '[class*="chat"] [class*="message"]',
    '.chat-message',
    '.message',
    '[role="log"] > div',
    '[class*="feed"] [class*="item"]',
    'div[class*="message"]',
    '[class*="Message"]'
  ];

  console.log('[JESUS EXTENSION] Searching for chat messages...');
  
  for (const selector of possibleSelectors) {
    const messages = document.querySelectorAll(selector);
    if (messages.length > 0) {
      console.log(`[JESUS EXTENSION] ✅ Found ${messages.length} messages using selector: ${selector}`);
      return Array.from(messages);
    }
  }

  console.log('[JESUS EXTENSION] ❌ No chat messages found. Available elements:', 
    Array.from(document.querySelectorAll('div')).slice(0, 20).map(el => el.className));
  return [];
}

/**
 * Extracts text and username from a message element
 */
function extractMessageData(element) {
  // Updated selectors for username extraction
  const usernameSelectors = [
    '[data-testid="username"]',
    '[class*="username"]',
    '[class*="user"]',
    '[class*="name"]',
    '[class*="author"]',
    'strong',
    'b',
    'span[class*="name"]',
    'div[class*="name"]'
  ];

  let username = 'Anonymous';
  for (const selector of usernameSelectors) {
    const userEl = element.querySelector(selector);
    if (userEl && userEl.textContent.trim()) {
      username = userEl.textContent.trim();
      console.log(`[JESUS EXTENSION] Found username: ${username} using selector: ${selector}`);
      break;
    }
  }

  // Get full message text, excluding potential username elements
  const text = element.textContent.trim();
  
  console.log(`[JESUS EXTENSION] Message data - User: ${username}, Text: "${text.substring(0, 50)}..."`);

  return { username, text, element };
}

/**
 * Checks if message starts with "jesus " and extracts question
 */
function extractQuestion(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Must start with "jesus " (with a space after)
  if (!lower.startsWith(TRIGGER_PREFIX + ' ')) return null;

  const question = trimmed.slice(TRIGGER_PREFIX.length).trim();
  if (question.length < 3) return null;

  return question;
}

/**
 * Sends question to backend
 */
async function sendToBackend(username, question) {
  console.log(`[JESUS EXTENSION] 🚀 Sending to backend: ${username} asked "${question}"`);
  
  try {
    const response = await fetch('http://localhost:3000/api/test-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, question })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[JESUS EXTENSION] ✅ Backend response received:', data);
      console.log('[JESUS EXTENSION] 📖 Jesus responded:', data.response);
      return true;
    } else {
      console.error('[JESUS EXTENSION] ❌ Backend error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('[JESUS EXTENSION] Error details:', errorText);
      return false;
    }
  } catch (error) {
    console.error('[JESUS EXTENSION] ❌ Network error sending to backend:', error);
    console.log('[JESUS EXTENSION] 💡 Make sure the server is running on localhost:3000');
    return false;
  }
}

/**
 * Processes chat messages
 */
function processMessages() {
  const messages = findChatMessages();
  
  if (messages.length === 0) {
    return;
  }

  for (const msgElement of messages) {
    // Create unique ID for this message
    const messageId = msgElement.textContent.trim();
    
    if (processedMessages.has(messageId)) {
      continue;
    }

    processedMessages.add(messageId);

    // Clean up old processed messages (keep last 500)
    if (processedMessages.size > 500) {
      const arr = Array.from(processedMessages);
      processedMessages.clear();
      arr.slice(-250).forEach(id => processedMessages.add(id));
    }

    // Extract message data
    const { username, text } = extractMessageData(msgElement);

    // Check if it's a Jesus question
    const question = extractQuestion(text);
    if (question) {
      console.log('[JESUS EXTENSION] 🙏 Question detected!');
      console.log('[JESUS EXTENSION] User:', username);
      console.log('[JESUS EXTENSION] Question:', question);
      
      // Send to backend
      sendToBackend(username, question);
      
      // Highlight the message (optional visual feedback)
      msgElement.style.borderLeft = '3px solid gold';
      msgElement.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
    }
  }
}

// ============================================================
// OBSERVER SETUP
// ============================================================

// Use MutationObserver to detect new chat messages
const observer = new MutationObserver((mutations) => {
  processMessages();
});

// Start observing when DOM is ready
function startMonitoring() {
  // Updated selectors for chat container
  const chatContainerSelectors = [
    '[data-testid="chat-container"]',
    '[data-testid="chat"]',
    '[class*="chat-container"]',
    '[class*="chat"]',
    '[class*="Chat"]',
    '[class*="messages"]',
    '[class*="feed"]',
    '[role="log"]',
    'main',
    '#root',
    'body'
  ];

  let chatContainer = null;
  for (const selector of chatContainerSelectors) {
    chatContainer = document.querySelector(selector);
    if (chatContainer) {
      console.log(`[JESUS EXTENSION] ✅ Found chat container: ${selector}`);
      break;
    }
  }

  if (!chatContainer) {
    chatContainer = document.body;
    console.log('[JESUS EXTENSION] Using document.body as fallback container');
  }

  console.log('[JESUS EXTENSION] 🎯 Starting observation on:', chatContainer.tagName + (chatContainer.className ? '.' + chatContainer.className : ''));

  // Start observing
  observer.observe(chatContainer, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: true
  });

  console.log('[JESUS EXTENSION] 👀 Monitoring chat for "jesus <question>" messages...');
  console.log('[JESUS EXTENSION] 📝 Trigger prefix: "' + TRIGGER_PREFIX + '"');

  // Also poll periodically as backup
  setInterval(processMessages, CHECK_INTERVAL);
  
  // Process existing messages
  setTimeout(() => {
    console.log('[JESUS EXTENSION] 🔍 Processing existing messages...');
    processMessages();
  }, 1000);
}

// Start when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startMonitoring);
} else {
  startMonitoring();
}

// Also try after a delay to ensure page is fully loaded
setTimeout(startMonitoring, 2000);
