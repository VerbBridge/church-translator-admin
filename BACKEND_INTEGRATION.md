# Backend Integration Summary

## Files Added

### 1. `lib/translation-client.ts` (NEW)
Complete WebSocket client for real-time audio streaming and translation receiving.

**Features:**
- WebSocket connection management
- Audio capture from USB audio interface
- Opus encoding via MediaRecorder
- 1-second chunk streaming
- Automatic reconnection
- Keep-alive ping/pong
- Event-based callbacks for translations, status, errors

**Usage:**
```typescript
const client = new TranslationClient({
  sessionId: "session-123",
  onTranslation: (msg) => console.log(msg),
  onConnectionChange: (connected) => console.log(connected)
});

await client.connect();
await client.startAudioCapture(deviceId);
```

### 2. `app/sessions/[id]/live-session.tsx` (NEW)
Real-time session monitoring component.

**Features:**
- WebSocket connection status
- Audio streaming controls
- Live translation feed
- Active client counter
- Content type badges (speech/scripture/song)
- Confidence scores
- Error handling

### 3. `INTEGRATION_GUIDE.md` (NEW)
Complete testing and deployment guide.

## Files Modified

### 1. `app/sessions/[id]/page.tsx`
- Now uses `LiveSession` component
- Simplified to just session lookup and component rendering

### 2. `lib/api.ts`
- Updated `createSession()` to match backend API (church_id parameter)
- Updated `stopSession()` to use DELETE method

### 3. `.env.local`
- Added `NEXT_PUBLIC_API_URL=http://localhost:8000`
- Configured for easy switching between mock and real backend

## Quick Start

### 1. Start Backend (Terminal 1)
```bash
cd /Users/jaycaceres/Desktop/church-translator
uvicorn api.main:app --reload
```

### 2. Start Admin Dashboard (Terminal 2)
```bash
cd /Users/jaycaceres/Desktop/church-translator-admin
npm run dev
```

### 3. Switch to Real Backend
Edit `.env.local`:
```bash
NEXT_PUBLIC_API_MOCK=false  # Change to false
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Restart Next.js server (Ctrl+C, then `npm run dev`)

### 4. Test Connection
1. Visit http://localhost:3000/sessions
2. Click on a session (or create one)
3. Look for "● Connected" (green) indicator
4. Click "Start Streaming Audio"
5. Speak into microphone
6. Watch translations appear!

## Backend Endpoints Used

```
# REST API
POST   /api/sessions          Create new session
GET    /api/sessions          List all sessions
GET    /api/sessions/{id}     Get session details
DELETE /api/sessions/{id}     End session

# WebSocket
WS     /api/ws/sessions/{id}  Real-time translation stream
```

## WebSocket Message Flow

```
Admin Dashboard                    FastAPI Backend
     │                                    │
     ├──── WS Connect ──────────────────>│
     │<──── Status: Connected ───────────┤
     │                                    │
     ├──── Audio Chunk (base64) ────────>│
     │                                    ├─> Decode Opus
     │                                    ├─> VAD Check
     │                                    ├─> ASR (Whisper)
     │                                    ├─> Classify (RAG)
     │                                    ├─> Translate (MT)
     │<──── Translation Result ──────────┤
     │                                    │
     │<──── Broadcast to all clients ────┤
```

## Testing Checklist

- [ ] Backend running on http://localhost:8000
- [ ] Backend health check passes
- [ ] Admin dashboard running on http://localhost:3000
- [ ] `.env.local` set to `NEXT_PUBLIC_API_MOCK=false`
- [ ] Next.js dev server restarted after env change
- [ ] Browser microphone permission granted
- [ ] WebSocket connects (see green "● Connected")
- [ ] Audio device selected
- [ ] Streaming starts successfully
- [ ] Translations appear in feed
- [ ] Active client count increments

## Browser Console Debug

Open DevTools (F12) → Console

**Expected logs when working:**
```
[TranslationClient] Connecting to: ws://localhost:8000/api/ws/sessions/{id}
[TranslationClient] Connected to translation service
[TranslationClient] Starting audio capture from device: {deviceId}
[TranslationClient] Audio capture started
[TranslationClient] Received: translation {...}
```

## Common Issues

### WebSocket won't connect
- Backend not running
- Wrong API URL in .env.local
- Need to restart Next.js after env change

### No audio streaming
- Microphone permission denied
- Audio device in use by another app
- Wrong device selected

### No translations appearing
- Models not loaded (check /health endpoint)
- Not speaking loud enough
- Not speaking Spanish (models trained on Spanish)

## Next Steps

1. **Test with real USB audio interface**
2. **Deploy backend to Railway/Render**
3. **Update production env vars**
4. **Add real QR code component**
5. **Build mobile app for translation receiving**

See `INTEGRATION_GUIDE.md` for detailed instructions!