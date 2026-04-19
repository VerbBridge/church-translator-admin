# Admin Dashboard - Backend Integration Guide

**Status:** Ready for Testing
**Date:** 2026-01-25

---

## Overview

This guide covers how to connect the Next.js Admin Dashboard to the FastAPI backend for real-time translation streaming.

---

## What's Been Implemented

### 1. WebSocket Client (`lib/translation-client.ts`)

A complete WebSocket client that:
- Connects to FastAPI backend at `/api/ws/sessions/{sessionId}`
- Captures audio from USB audio interface
- Encodes audio as Opus in WebM container
- Streams 1-second audio chunks to backend
- Receives real-time translations
- Handles reconnection automatically
- Sends keep-alive pings every 30 seconds

### 2. Live Session Component (`app/sessions/[id]/live-session.tsx`)

A real-time session monitoring interface with:
- WebSocket connection status indicator
- Start/Stop audio streaming controls
- Live translation feed with content type badges
- Active client counter
- Translation counter
- QR code for mobile app joining
- Error handling and display

### 3. Updated API Client (`lib/api.ts`)

Backend integration endpoints:
- `createSession()` - Creates session via REST API
- `stopSession()` - Ends session via REST API
- Compatible with FastAPI backend endpoints

---

## Testing the Integration

### Step 1: Start the Backend

```bash
cd /Users/jaycaceres/Desktop/church-translator

# Make sure PostgreSQL is running
# The database should already have test data (church_id=1, session test-session-123)

# Start the FastAPI server
uvicorn api.main:app --reload
```

You should see:
```
INFO:     Starting Church Translator API...
INFO:     Initializing Translation Service...
INFO:     ✓ Church Translator API started
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 2: Verify Backend Health

Open browser to: http://localhost:8000/health

Expected response:
```json
{
  "status": "healthy",
  "service": "church-translator-api",
  "models": {
    "asr": false,
    "rag": false,
    "heuristic": true
  },
  "active_sessions": 0
}
```

### Step 3: Start the Admin Dashboard

```bash
cd /Users/jaycaceres/Desktop/church-translator-admin

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Admin dashboard will run on: http://localhost:3000

### Step 4: Switch to Real Backend Mode

Edit `.env.local`:
```bash
# Change from:
NEXT_PUBLIC_API_MOCK=true

# To:
NEXT_PUBLIC_API_MOCK=false

# Keep:
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Restart the Next.js dev server** after changing environment variables.

### Step 5: Test WebSocket Connection

1. **Navigate to an existing session:**
   - Go to http://localhost:3000/sessions
   - Click on an existing session (mock data)
   - You'll see the live session page

2. **Or create a new session via API:**
   ```bash
   # Create a new session in the backend
   curl -X POST http://localhost:8000/api/sessions \
     -H "Content-Type: application/json" \
     -d '{
       "church_id": 1,
       "name": "Test Live Session"
     }'
   ```

   Note the `id` returned, then visit:
   `http://localhost:3000/sessions/{session-id}`

3. **Check browser console:**
   - Open DevTools (F12) → Console
   - You should see: `[TranslationClient] Connected to translation service`

4. **Verify WebSocket connection:**
   - Connection indicator should show "● Connected" (green)
   - Active clients should show "1"

### Step 6: Test Audio Streaming

1. **Allow microphone access** when prompted by browser

2. **Select audio input device:**
   - If you have a USB audio interface connected, select it
   - Otherwise, select your default microphone for testing

3. **Click "Start Streaming Audio":**
   - Button should change to "Pause Streaming"
   - Status should show "● Streaming Audio" (red)

4. **Check backend logs:**
   ```
   INFO:     Client connected to session {session_id}. Total: 1
   DEBUG:    Session {session_id}: Received audio chunk
   ```

5. **Watch translation feed:**
   - Speak into microphone (Spanish for best results)
   - Translations should appear in the feed
   - Each translation shows:
     - Content type badge (speech/scripture/song)
     - Confidence score
     - Spanish source text
     - English target text
     - Timestamp

---

## Architecture Flow

```
┌─────────────────────────┐
│   Admin Dashboard       │
│   (Next.js)             │
│                         │
│  1. Audio Device        │
│     ↓                   │
│  2. MediaRecorder       │
│     ↓ (Opus/WebM)       │
│  3. TranslationClient   │
│     ↓ (WebSocket)       │
└──────────┬──────────────┘
           │
           │ WebSocket: /api/ws/sessions/{id}
           │ Audio: base64 Opus chunks (1-sec)
           │
┌──────────▼──────────────┐
│   FastAPI Backend       │
│                         │
│  1. WebSocket Handler   │
│     ↓                   │
│  2. TranslationService  │
│     ↓                   │
│  3. Decode Opus → PCM16 │
│     ↓                   │
│  4. VAD (silence check) │
│     ↓                   │
│  5. ASR (Whisper)       │
│     ↓                   │
│  6. RAG Classifier      │
│     ↓                   │
│  7. MT / Scripture      │
│     ↓                   │
│  8. Broadcast Result    │
└──────────┬──────────────┘
           │
           │ Translation results
           │
┌──────────▼──────────────┐
│  All Connected Clients  │
│  - Admin Dashboard      │
│  - Mobile Apps          │
└─────────────────────────┘
```

---

## Message Formats

### Client → Server (Audio)

```json
{
  "type": "audio",
  "format": "opus",
  "sample_rate": 48000,
  "data": "<base64 encoded WebM/Opus audio>"
}
```

### Server → Client (Translation)

```json
{
  "type": "translation",
  "content_type": "speech",
  "source_text": "Bienvenidos hermanos",
  "target_text": "Welcome brothers",
  "confidence": 0.95,
  "timestamp": "2026-01-25T10:30:00Z"
}
```

### Server → Client (Status)

```json
{
  "type": "status",
  "message": "Connected to translation service",
  "session_id": "test-session-123",
  "active_clients": 2
}
```

### Keep-Alive (Ping/Pong)

```json
// Client → Server
{ "type": "ping" }

// Server → Client
{ "type": "pong" }
```

---

## Troubleshooting

### Issue: "Failed to connect" Error

**Check:**
1. Backend is running on http://localhost:8000
2. `.env.local` has `NEXT_PUBLIC_API_MOCK=false`
3. Restarted Next.js dev server after env change
4. Browser console shows WebSocket URL

**Solution:**
```bash
# Verify backend is accessible
curl http://localhost:8000/health

# Check WebSocket URL in browser console
# Should be: ws://localhost:8000/api/ws/sessions/{id}
```

### Issue: "Session not found in database"

**Check:**
1. Session exists in database
2. Using correct session ID

**Solution:**
```bash
# Create test session via API
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"church_id": 1, "name": "Test Session"}'

# Or use the existing test session
# Session ID: test-session-123
```

### Issue: No audio being captured

**Check:**
1. Browser microphone permissions granted
2. Audio device selected correctly
3. Device is not in use by another application

**Solution:**
- Check browser settings → Privacy → Microphone
- Try different audio input device
- Close other apps using the microphone

### Issue: Translations not appearing

**Check:**
1. Backend models loaded (check `/health` endpoint)
2. Speaking loud enough / clear audio
3. Speaking Spanish (models trained on Spanish)

**Solution:**
```bash
# Check backend health
curl http://localhost:8000/health

# Look for model status:
# "asr": false means Whisper not loaded (graceful degradation)
# "heuristic": true means basic classifier working
```

### Issue: CORS errors in browser console

**Check:**
1. Backend CORS settings in `api/config.py`
2. Frontend URL in CORS_ORIGINS

**Solution:**
Edit `church-translator/api/config.py`:
```python
CORS_ORIGINS: List[str] = [
    "http://localhost:3000",  # Add this
    "http://localhost:19006"
]
```

Then restart backend.

---

## Next Steps

### 1. Test with Real USB Audio Interface

1. Connect church audio mixer to USB audio interface
2. Plug USB interface into computer
3. Refresh admin dashboard
4. Select USB audio device from dropdown
5. Start streaming

### 2. Test with Multiple Clients

1. Open admin dashboard in one browser tab (streaming audio)
2. Open another tab to same session (receiving translations)
3. Verify both see translations
4. Check active client count increments

### 3. Deploy Backend to Production

See `DEPLOYMENT_ROADMAP.md` in the backend project for deployment steps.

### 4. Update Frontend for Production

When backend is deployed:

```bash
# .env.production
NEXT_PUBLIC_API_MOCK=false
NEXT_PUBLIC_API_URL=https://api.yourchurch.com
```

Build for production:
```bash
npm run build
npm start
```

### 5. Add QR Code Generation

Install QR code library:
```bash
npm install qrcode.react
```

Update `live-session.tsx` to use real QR codes instead of placeholder.

---

## API Endpoints Reference

### REST API

```
POST   /api/sessions              Create session
GET    /api/sessions              List sessions
GET    /api/sessions/{id}         Get session details
DELETE /api/sessions/{id}         End session
```

### WebSocket

```
WS     /api/ws/sessions/{id}      Real-time translation
```

---

## Performance Notes

### Audio Settings

- **Sample Rate:** 48kHz (captured) → 16kHz (backend resamples)
- **Codec:** Opus (efficient, low latency)
- **Chunk Size:** 1 second (good balance)
- **Bitrate:** 64kbps (high quality)

### Latency Breakdown

1. Audio capture: ~1 second (chunk size)
2. Encoding: <50ms (Opus)
3. Network: <100ms (local) / <500ms (cloud)
4. Backend processing: ~1-3 seconds (with models)
5. Broadcast: <50ms

**Total latency:** 2-5 seconds end-to-end

### Bandwidth Usage

- **Per client (streaming):** ~64kbps upload
- **Per client (receiving):** <5kbps download (text only)
- **100 users:** ~500KB/s total (~4Mbps)

---

## Development Tips

### Enable Debug Logging

Browser console:
```javascript
localStorage.setItem('debug', 'translation-client');
```

Backend logging (already configured in `api/main.py`):
```python
logging.basicConfig(level=logging.DEBUG)
```

### Mock Mode for UI Development

Keep `NEXT_PUBLIC_API_MOCK=true` to develop UI without running backend.

### Test WebSocket Manually

```javascript
// Browser console
const ws = new WebSocket('ws://localhost:8000/api/ws/sessions/test-session-123');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({ type: 'ping' }));
```

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check backend logs for errors
3. Verify network tab shows WebSocket connection (Status 101 Switching Protocols)
4. Test backend health endpoint
5. Verify database has test data

---

**Ready to test!** 🚀

Start both servers and navigate to http://localhost:3000/sessions