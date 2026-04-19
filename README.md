# Church Translator - Admin Dashboard

Admin dashboard for managing real-time church service translations.

## Features

- Session management (create, monitor, end)
- Real-time audio streaming via WebSocket
- Live translation feed with content classification
- Audio device selection (USB audio interface support)
- Active client monitoring
- QR code generation for mobile app joining
- Song library management

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Zustand** - State management
- **WebSocket** - Real-time communication

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create/edit `.env.local`:

```bash
# For development with mock data
NEXT_PUBLIC_API_MOCK=true
NEXT_PUBLIC_API_URL=http://localhost:8000

# For production/real backend
NEXT_PUBLIC_API_MOCK=false
NEXT_PUBLIC_API_URL=https://api.yourchurch.com
```

### 3. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Backend Integration

This dashboard connects to the Church Translator FastAPI backend.

**See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for complete setup instructions.**

### Quick Backend Setup

1. **Start backend:**
   ```bash
   cd ../church-translator
   uvicorn api.main:app --reload
   ```

2. **Update `.env.local`:**
   ```bash
   NEXT_PUBLIC_API_MOCK=false
   ```

3. **Restart Next.js dev server**

4. **Test connection:**
   - Visit http://localhost:3000/sessions
   - Look for "● Connected" indicator

## Key Components

### TranslationClient (`lib/translation-client.ts`)
WebSocket client for audio streaming and translation receiving.

```typescript
import { TranslationClient } from '@/lib/translation-client';

const client = new TranslationClient({
  sessionId: 'session-123',
  onTranslation: (msg) => console.log(msg),
  onConnectionChange: (connected) => console.log(connected)
});

await client.connect();
await client.startAudioCapture(deviceId);
```

### LiveSession (`app/sessions/[id]/live-session.tsx`)
Real-time session monitoring with translation feed.

### AudioDeviceSelector (`components/AudioDeviceSelector.tsx`)
Dropdown to select USB audio interface or microphone.

## Development

### Mock Mode
For UI development without backend:
```bash
NEXT_PUBLIC_API_MOCK=true
```

### Debug Logging
Enable in browser console:
```javascript
localStorage.setItem('debug', 'translation-client');
```

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## Project Structure

```
church-translator-admin/
├── app/
│   ├── sessions/
│   │   ├── [id]/
│   │   │   ├── page.tsx          # Session detail page
│   │   │   └── live-session.tsx  # Live session component
│   │   ├── new/
│   │   │   └── page.tsx          # Create session page
│   │   └── page.tsx              # Sessions list
│   ├── songs/page.tsx            # Song management
│   ├── settings/page.tsx         # Settings
│   └── layout.tsx                # Root layout
├── components/
│   ├── AudioDeviceSelector.tsx   # Device picker
│   ├── LayoutWithSidebar.tsx     # Main layout
│   └── ...
├── lib/
│   ├── translation-client.ts     # WebSocket client
│   ├── api.ts                    # REST API client
│   └── store.ts                  # Zustand store
└── public/                       # Static assets
```

## Documentation

- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - Complete backend integration guide
- [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md) - Quick integration summary

## Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

```bash
vercel deploy
```

Set environment variables in Vercel:
- `NEXT_PUBLIC_API_MOCK=false`
- `NEXT_PUBLIC_API_URL=https://api.yourchurch.com`

## Browser Support

- Chrome/Edge (recommended for WebRTC/MediaRecorder)
- Firefox
- Safari (limited WebRTC support)

## License

MIT
