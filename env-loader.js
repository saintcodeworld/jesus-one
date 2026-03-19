// ============================================================
// ENV LOADER — Fetches config from backend API
// ============================================================

async function loadEnv() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Config API not available');
    const config = await res.json();
    return config;
  } catch (e) {
    console.warn('Could not load config from API:', e.message);
    return {};
  }
}
