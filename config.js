// ============================================================
// CONFIG — Keys are loaded from .env at runtime via env-loader.js
// Fallback: edit the values below directly if .env is unavailable.
// ============================================================

const CONFIG = {
  // ---- LLM Brain ----
  OPENAI_API_KEY: '',
  OPENAI_MODEL: 'gpt-4o',

  // ---- Voice / TTS (choose one) ----
  TTS_PROVIDER: 'elevenlabs',
  ELEVENLABS_API_KEY: '',
  ELEVENLABS_VOICE_ID: '',

  // ---- Gameplay ----
  INTERACTION_DISTANCE: 200,
  FIGURE_SCALE: 40,
  FOG_DENSITY: 0.003,
  FIGURE_DISTANCE: 150,

  // ---- System Prompt for the LLM ----
  SYSTEM_PROMPT: `You are a wise, compassionate, and serene divine figure standing in an ethereal dreamscape. You speak with calm authority and gentle wisdom. Your responses are thoughtful, poetic, and carry deep spiritual insight. Keep responses concise — under 3 sentences unless the question demands more. Speak as if you are an ancient being who has witnessed all of creation.`,
};

// Hydrate CONFIG from backend API (called before app starts)
async function hydrateConfig() {
  const env = await loadEnv();
  console.log('[CONFIG DEBUG] Received from API:', env);
  
  // Direct assignment from API response
  if (env.OPENAI_API_KEY) CONFIG.OPENAI_API_KEY = env.OPENAI_API_KEY;
  if (env.OPENAI_MODEL) CONFIG.OPENAI_MODEL = env.OPENAI_MODEL;
  if (env.TTS_PROVIDER) CONFIG.TTS_PROVIDER = env.TTS_PROVIDER;
  if (env.ELEVENLABS_API_KEY) CONFIG.ELEVENLABS_API_KEY = env.ELEVENLABS_API_KEY;
  if (env.ELEVENLABS_VOICE_ID) CONFIG.ELEVENLABS_VOICE_ID = env.ELEVENLABS_VOICE_ID;
  
  console.log('[CONFIG DEBUG] After hydration:', {
    hasOpenAI: !!CONFIG.OPENAI_API_KEY,
    hasElevenLabs: !!CONFIG.ELEVENLABS_API_KEY,
    hasVoiceId: !!CONFIG.ELEVENLABS_VOICE_ID,
    provider: CONFIG.TTS_PROVIDER
  });
}
