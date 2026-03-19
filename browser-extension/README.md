# Jesus Pump.fun Responder - Browser Extension

This Chrome/Edge extension monitors pump.fun chat for messages starting with "jesus <question>" and sends them to your Jesus response backend.

## Installation

### 1. Load Extension in Chrome/Edge

1. Open Chrome or Edge browser
2. Go to `chrome://extensions/` (or `edge://extensions/`)
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `browser-extension` folder from this project
6. The extension should now appear in your extensions list

### 2. Make Sure Backend is Running

```bash
cd "/Users/thedev/Downloads/jesus project"
npm start
```

Server should be running on `http://localhost:3000`

### 3. Visit Your Pump.fun Coin

1. Go to `https://pump.fun/<your-coin-address>`
2. The extension will automatically start monitoring the chat
3. Open browser console (F12) to see extension logs

## How It Works

1. **User types in pump.fun chat:** `jesus what is the meaning of life?`
2. **Extension detects** the message starting with "jesus "
3. **Extension sends** the question to `http://localhost:3000/api/test-question`
4. **Backend generates** Jesus response via OpenAI
5. **Response appears** in the 3D experience at `http://localhost:3000`
6. **Jesus speaks** the response using ElevenLabs voice

## Testing

1. Open `http://localhost:3000` (3D experience) in one tab
2. Open your pump.fun coin page in another tab
3. Type in the pump.fun chat: `jesus why are we here?`
4. Check the 3D experience - you should see the question and Jesus's response
5. Jesus should speak the answer aloud

## Troubleshooting

### Extension not detecting messages

1. Open browser console (F12) on pump.fun page
2. Look for `[JESUS EXTENSION]` logs
3. If you see "Found 0 messages", the chat selectors may need adjustment
4. Check `content.js` and update the selectors to match pump.fun's actual DOM structure

### Backend not receiving questions

1. Check extension has permission to access `http://localhost:3000`
2. Verify backend is running: `curl http://localhost:3000/api/config`
3. Check browser console for CORS or network errors

### No voice response

1. Verify ElevenLabs API key is set in `.env`
2. Check browser console for TTS errors
3. Reload `http://localhost:3000` to refresh config

## Files

- `manifest.json` - Extension configuration
- `content.js` - Monitors pump.fun chat DOM
- `background.js` - Background service worker
- `popup.html` - Extension popup UI
- `icon.png` - Extension icon
