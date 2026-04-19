# Church Translator — Admin Dashboard

Next.js admin dashboard for managing real-time Spanish → English church translation sessions. Admins stream audio from a microphone, monitor live translations, and manage the song library. Attendees connect via a shareable watch link that shows translations with a song lyrics overlay.

---

## Architecture

```
Admin (this app)
  ├── Live Session Page
  │     AudioWorklet (48kHz PCM16) ──WebSocket──► Backend ASR/MT pipeline
  │     ◄──────────────────── translations, song events, errors
  │
  ├── Watch Page (attendees)
  │     WebSocket /api/ws/watch/{session_id}
  │     ◄── translation feed, song overlay, history on connect
  │     TTS: Kokoro (backend) → Web Speech API fallback
  │
  ├── Song Library
  │     Import manually or from ProPresenter library browser
  │     Section editor (verse/chorus/bridge + Spanish + English text)
  │
  └── Settings
        Language + Bible version config
        VAD audio calibration
        ProPresenter bridge status + download
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Audio | Web Audio API (AudioWorklet, PCM16 at 48kHz) |
| TTS | Kokoro via backend `/api/tts`, fallback to Web Speech API |
| Testing | Vitest + Testing Library |
| Containerization | Docker (standalone output) |

---

## Project Structure

```
church-translator-admin/
├── app/                           # Next.js App Router pages
│   ├── layout.tsx                 # Root layout (sidebar nav)
│   ├── page.tsx                   # Dashboard home (session summary)
│   ├── login/
│   │   └── page.tsx               # JWT login form
│   ├── sessions/
│   │   ├── page.tsx               # Sessions list
│   │   ├── new/page.tsx           # Create session form
│   │   └── [id]/
│   │       ├── page.tsx           # Session detail + controls
│   │       └── live-session.tsx   # Audio streaming + translation display
│   ├── songs/
│   │   ├── page.tsx               # Song library table
│   │   ├── [id]/page.tsx          # Song editor (sections)
│   │   └── import/
│   │       ├── page.tsx           # Manual import (paste lyrics)
│   │       └── propresenter/
│   │           └── page.tsx       # Import from ProPresenter library
│   ├── settings/
│   │   ├── page.tsx               # Language/Bible/ProPresenter settings
│   │   └── calibration/page.tsx   # VAD microphone calibration wizard
│   └── watch/
│       └── [sessionId]/page.tsx   # Attendee view (public, no auth)
│
├── components/
│   ├── LayoutWithSidebar.tsx      # Sidebar + main content wrapper
│   ├── AudioDeviceSelector.tsx    # Microphone dropdown (enumerates devices)
│   ├── AudioLevelMeter.tsx        # Real-time RMS level bar
│   ├── SessionRow.tsx             # Sessions table row
│   └── StatCard.tsx               # Dashboard stat tile
│
├── lib/
│   ├── api.ts                     # REST API client (all backend calls)
│   ├── translation-client.ts      # WebSocket + AudioWorklet orchestration
│   ├── store.ts                   # Zustand global state
│   └── calibration-client.ts      # VAD calibration WebSocket client
│
├── public/
│   └── audio-processor.js         # AudioWorklet processor (runs in audio thread)
│
├── __tests__/
│   ├── components/AudioLevelMeter.test.tsx
│   └── lib/api.test.ts, store.test.ts
│
├── Dockerfile
├── Makefile
├── .env.example
├── .nvmrc                         # Node 20
└── next.config.ts                 # output: standalone (Docker)
```

---

## Pages

### Live Session (`/sessions/[id]`)

The core admin view. Connects to the backend via WebSocket and streams PCM16 audio.

**Audio pipeline:**
1. `AudioDeviceSelector` — user picks microphone from enumerated devices
2. `getUserMedia` → `AudioContext` (48kHz) → `AudioWorklet` (runs off main thread)
3. `audio-processor.js` batches PCM16 samples and posts to main thread every ~500ms
4. `TranslationClient` base64-encodes chunks and sends over WebSocket
5. Backend responds with translation/song/scripture events
6. Song events trigger a full-screen lyrics overlay; `song_ended` reconnects WebSocket for fresh history

**Song mode:**
- `song_started` — overlay appears with all sections (verse/chorus/bridge)
- While overlay is active, TTS is suppressed
- `song_ended` — overlay clears, WebSocket reconnects (code 1000) to receive updated history

### Watch Page (`/watch/[sessionId]`)

Public page for attendees — no login required. Connects to `/api/ws/watch/{sessionId}`.

- Receives translation history on connect (`type: "history"`)
- Live translations append to a reverse-chronological feed
- Song mode replaces the feed with a full lyrics overlay (blue/purple gradient)
- TTS reads translations aloud (Kokoro via backend, Web Speech API fallback)
- Font size toggle (A / A+ / A++), TTS on/off toggle
- Auto-reconnects on disconnect (immediately on song end, 3s otherwise)

### Song Library (`/songs`)

Table of all church songs with Spanish title, English title, section count, and active status. Edit links to a section editor where each verse/chorus/bridge has separate Spanish and English text fields.

**Import from ProPresenter** (requires feature flag + bridge connected):
- Browse ProPresenter libraries → select presentation
- "Fetch Lyrics" pulls slide text from ProPresenter via the bridge
- Manual paste always available as fallback
- On import: calls `POST /api/songs/import/sections` then `POST /api/songs/rebuild-index`

### Settings (`/settings`)

- Source/target language selection
- Bible version (source: RV1960/RV1909/NVI, target: KJV/NIV/ESV/NLT)
- **ProPresenter card** (visible only when `features.propresenter = true`):
  - Bridge status dot (green = connected, red = disconnected)
  - "Now playing" presentation name
  - Download pre-configured bridge app
  - Advanced host/port override (hidden by default)
- Audio Calibration link → calibration wizard

---

## API Client (`lib/api.ts`)

All backend calls go through the `api` object:

```ts
api.login(email, password)
api.getSessions()
api.createSession({ name, church_id, source_language, target_language })
api.stopSession(id)
api.getSongs(churchId)
api.importSongWithSections({ church_id, title, title_target, sections })
api.rebuildSongIndex()
api.getChurch(churchId)
api.saveChurchSettings(churchId, settings)
api.proPresenterStatus()
api.proPresenterLibraries()
api.proPresenterLibrary(id)
api.proPresenterPresentation(uuid)
api.proPresenterDownloadBridgeUrl(churchId)
```

Auth token is stored in `localStorage` (`authToken`) and sent as `Authorization: Bearer <token>`. A 401 response clears the token and redirects to `/login`.

---

## Audio Worklet

`public/audio-processor.js` runs in a dedicated audio thread (not subject to main-thread jank). It accumulates 4096-sample frames into ~500ms batches and posts raw `ArrayBuffer` to the main thread, which converts to base64 and sends over WebSocket as `{ type: "audio", format: "pcm16", sample_rate: 48000, data: "..." }`.

---

## Setup

```bash
# Requires Node 20 (.nvmrc)
nvm use

# Install
make install   # npm ci

# Configure
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL to your backend URL

# Dev server
make dev       # http://localhost:3000

# Tests
make test

# Type check
make type-check
```

### Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://your-backend.com \
  -t church-translator-admin .

docker run -p 3000:3000 church-translator-admin
```

`NEXT_PUBLIC_API_URL` must be set at **build time** — it gets embedded into the static bundle.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL (no trailing slash) |
| `NEXT_PUBLIC_API_MOCK` | `false` | Use mock data (for UI development without backend) |

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):

1. **Lint** — ESLint
2. **Type Check** — `tsc --noEmit`
3. **Test** — Vitest with mock mode enabled
4. **Build** — `next build` (verifies no type/import errors)
5. **Docker** — build + push to `ghcr.io` on merge to main

`NEXT_PUBLIC_API_URL` for production Docker is set via a GitHub Actions variable (`vars.NEXT_PUBLIC_API_URL`).
