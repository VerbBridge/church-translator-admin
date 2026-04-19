# Quick Test Guide - WebSocket Integration

## Current Status

✅ **Backend**: Running on http://localhost:8000
✅ **WebSocket**: Working! Test script passed
✅ **Admin Dashboard**: Running on http://localhost:3000
⚠️ **Environment**: Set to `NEXT_PUBLIC_API_MOCK=false`

---

## Test Steps

### 1. Verify Backend is Ready

Open: http://localhost:8000/health

**Expected:**
```json
{
  "status": "healthy",
  "service": "church-translator-api",
  "models": {
    "asr": true,
    "rag": false,
    "heuristic": true
  },
  "active_sessions": 0
}
```

### 2. Open Admin Dashboard

Visit: http://localhost:3000/sessions

You should see the sessions list page.

### 3. Test WebSocket Connection

Click on an existing session OR navigate directly to:
http://localhost:3000/sessions/test-session-123

**What to look for:**

1. **Connection Status**
   - Should show: **"● Connected"** (green)
   - If it says "○ Disconnected" (gray), check browser console for errors

2. **Active Clients**
   - Should show: **1** (you!)

3. **Browser Console** (F12 → Console)
   - Look for: `[TranslationClient] Connected to translation service`
   - Should NOT see: WebSocket connection errors

### 4. Test Audio Streaming

1. **Allow Microphone Access**
   - Browser will prompt for permission
   - Click "Allow"

2. **Select Audio Device**
   - If you have a USB audio interface, select it
   - Otherwise, use default microphone

3. **Start Streaming**
   - Click **"Start Streaming Audio"**
   - Button should change to **"Pause Streaming"**
   - Status should show: **"● Streaming Audio"** (red)

4. **Speak into Microphone**
   - Speak clearly in Spanish (models are trained on Spanish)
   - Example: "Bienvenidos hermanos" or "Juan tres dieciséis"

5. **Watch for Translations**
   - Translations should appear in the feed after 2-3 seconds
   - Each translation shows:
     - Content type badge (speech/scripture/song)
     - Confidence score
     - Spanish source text
     - English translation
     - Timestamp

### 5. Check Backend Logs

In the terminal running uvicorn, you should see:

```
INFO:     Client connected to session test-session-123. Total: 1
DEBUG:    Session test-session-123: Received audio chunk
```

---

## Troubleshooting

### Issue: "○ Disconnected" - Not Connecting

**Check:**
1. Backend running? → `curl http://localhost:8000/health`
2. Env configured? → Check `.env.local` has `NEXT_PUBLIC_API_MOCK=false`
3. Restarted Next.js? → After changing `.env.local`, restart with Ctrl+C, `npm run dev`

**Browser Console Error Messages:**
```
[TranslationClient] WebSocket error
```
→ Backend not running or wrong URL

### Issue: Connected but No Audio Streaming

**Check:**
1. Microphone permission granted?
2. Audio device selected?
3. Device not in use by another app?

**Browser Console:**
```
Failed to start audio: ...
```
→ Check microphone permissions in browser settings

### Issue: Streaming but No Translations

**Check:**
1. Backend models loaded? → Check `/health` endpoint
2. Speaking loud enough?
3. Speaking Spanish? (Models trained on Spanish)

**If ASR not loaded:**
- Translations won't work
- Check backend logs for model loading errors

### Issue: "Session not found in database"

**Solution:**
Create session via API:
```bash
curl -X POST http://localhost:8000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"church_id": 1, "name": "Test Live Session"}'
```

Then use the returned `id` in URL.

---

## What Each Part Does

### Admin Dashboard (Frontend)
1. Captures audio from USB interface (or mic)
2. Encodes as Opus/WebM
3. Sends 1-second chunks via WebSocket
4. Receives and displays translations

### Backend (FastAPI)
1. Receives WebSocket connection
2. Gets audio chunks
3. Decodes Opus → PCM16
4. Runs VAD (voice activity detection)
5. Transcribes with Whisper ASR
6. Classifies content (speech/scripture/song)
7. Translates or looks up scripture
8. Broadcasts result to all connected clients

### Flow
```
Microphone → MediaRecorder → WebSocket → Backend
                                           ↓
                                    VAD → ASR → RAG → MT
                                           ↓
                           WebSocket ← Translation
                                           ↓
                                   All Connected Clients
```

---

##Success Indicators

✅ Green "● Connected" indicator
✅ Active clients showing correct count
✅ No errors in browser console
✅ Audio streaming starts successfully
✅ Translations appear in feed within 2-3 seconds
✅ Backend logs show received audio chunks

---

## Next Steps After Testing

1. **Test with USB Audio Interface**
   - Connect church audio mixer to USB interface
   - Select device in dropdown
   - Test with real service audio

2. **Test Multi-Client**
   - Open multiple browser tabs to same session
   - Verify all receive translations
   - Check active client count increments

3. **Deploy to Production**
   - See `DEPLOYMENT_ROADMAP.md` in backend project
   - Update `.env.production` with production API URL

4. **Build Mobile App**
   - React Native app for congregation
   - Scan QR code to join
   - Receive translations in real-time

---

**Ready to test!** Open http://localhost:3000/sessions/test-session-123 and start streaming!