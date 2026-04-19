"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Translation {
  id: number;
  source_text: string;
  target_text: string;
  content_type: "speech" | "scripture" | "song";
  timestamp: string;
}

interface SongSection {
  section_number: number;
  section_name: string;
  text_source: string;
  text_target: string;
}

interface ActiveSong {
  song_id: number;
  song_title: string;
  song_title_en: string;
  sections: SongSection[];
}

const CONTENT_COLORS: Record<string, string> = {
  scripture: "text-amber-300",
  song: "text-blue-300",
  speech: "text-gray-400",
};

const CONTENT_LABELS: Record<string, string> = {
  scripture: "Scripture",
  song: "Song",
  speech: "Speech",
};

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "ended";


export default function WatchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [fontSize, setFontSize] = useState<"md" | "lg" | "xl">("lg");
  const [lastText, setLastText] = useState("");
  const [activeSong, setActiveSong] = useState<ActiveSong | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ttsEnabledRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const idCounter = useRef(0);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  const speak = useCallback(async (text: string) => {
    if (!ttsEnabledRef.current || !text.trim()) return;

    // Stop any currently playing audio
    currentSourceRef.current?.stop();
    currentSourceRef.current = null;

    try {
      // --- Kokoro TTS via backend ---
      const params = new URLSearchParams({ text, lang: "en" });
      const res = await fetch(`${apiUrl}/api/tts?${params}`);
      if (!res.ok) throw new Error("TTS endpoint unavailable");

      const arrayBuffer = await res.arrayBuffer();
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      currentSourceRef.current = source;
    } catch {
      // Fallback: Web Speech API if Kokoro endpoint is down
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    }
  }, [apiUrl]);

  // Stable ref so the WebSocket effect doesn't depend on `speak`
  const speakRef = useRef<typeof speak | null>(null);
  speakRef.current = speak;

  // Track song mode in a ref so TTS can check it without being a dep
  const activeSongRef = useRef<ActiveSong | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiUrl.replace("http://", "ws://").replace("https://", "wss://");
    const url = `${wsUrl}/api/ws/watch/${sessionId}`;

    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let dead = false;

    function connect() {
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setStatus("connected");

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "ping" }));
            return;
          }

          if (msg.type === "history" && Array.isArray(msg.translations)) {
            const entries: Translation[] = msg.translations.map((t: {
              source_text: string;
              translated_text: string;
              content_type: string;
              timestamp: string;
            }) => ({
              id: ++idCounter.current,
              source_text: t.source_text || "",
              target_text: t.translated_text,
              content_type: (t.content_type as Translation["content_type"]) || "speech",
              timestamp: t.timestamp,
            }));
            setTranslations(entries);
            if (entries.length > 0) setLastText(entries[entries.length - 1].target_text);
            return;
          }

          if (msg.type === "song_started" && msg.song_id) {
            const song = {
              song_id: msg.song_id,
              song_title: msg.song_title || "",
              song_title_en: msg.song_title_en || msg.song_title || "",
              sections: msg.sections || [],
            };
            activeSongRef.current = song;
            setActiveSong(song);
            // Stop any playing audio when song mode starts
            currentSourceRef.current?.stop();
            currentSourceRef.current = null;
            window.speechSynthesis?.cancel();
          }

          if (msg.type === "song_ended") {
            activeSongRef.current = null;
            setActiveSong(null);
            // Reconnect immediately to get fresh history + re-enter broadcast group
            ws.close();
            return;
          }

          if (msg.type === "translation" && (msg.translated_text || msg.target_text)) {
            const entry: Translation = {
              id: ++idCounter.current,
              source_text: msg.source_text || "",
              target_text: msg.translated_text || msg.target_text,
              content_type: msg.content_type || "speech",
              timestamp: msg.timestamp || new Date().toISOString(),
            };
            setTranslations((prev) => [...prev.slice(-49), entry]);
            setLastText(entry.target_text);
            // Skip TTS while song overlay is active
            if (!activeSongRef.current) {
              speakRef.current?.(entry.target_text);
            }
          }

          if (msg.type === "error" && msg.error === "Session has ended") {
            setStatus("ended");
            ws.close();
          }
        } catch {}
      };

      ws.onclose = (event) => {
        if (dead) return;
        // code 1000 = intentional close (e.g. song_ended reconnect) — reconnect immediately
        const delay = event.code === 1000 ? 0 : 3000;
        setStatus("disconnected");
        reconnectTimeout = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      dead = true;
      clearTimeout(reconnectTimeout);
      window.speechSynthesis?.cancel();
      wsRef.current?.close();
    };
  }, [sessionId]);


  const fontSizeClass = { md: "text-xl", lg: "text-2xl", xl: "text-3xl" }[fontSize];
  const sourceSizeClass = { md: "text-sm", lg: "text-base", xl: "text-lg" }[fontSize];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === "connected"
                ? "bg-green-400"
                : status === "connecting" || status === "disconnected"
                ? "bg-yellow-400 animate-pulse"
                : "bg-red-400"
            }`}
          />
          <span className="text-sm text-gray-400">
            {status === "connected"
              ? "Live"
              : status === "connecting"
              ? "Connecting..."
              : status === "disconnected"
              ? "Reconnecting..."
              : "Session ended"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Font size */}
          <div className="flex gap-1">
            {(["md", "lg", "xl"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                className={`px-2 py-1 rounded text-xs font-bold transition ${
                  fontSize === s
                    ? "bg-gray-600 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {s === "md" ? "A" : s === "lg" ? "A" : "A"}
                <sup>{s === "md" ? "" : s === "lg" ? "+" : "++"}</sup>
              </button>
            ))}
          </div>

          {/* TTS toggle */}
          <button
            onClick={() => {
              setTtsEnabled((v) => {
                if (v) {
                  currentSourceRef.current?.stop();
                  currentSourceRef.current = null;
                  window.speechSynthesis?.cancel();
                }
                return !v;
              });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
              ttsEnabled
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-400"
            }`}
          >
            {ttsEnabled ? "🔊 Audio On" : "🔇 Audio Off"}
          </button>
        </div>
      </div>

      {/* Latest translation — prominent at top */}
      {lastText && (
        <div className="px-6 py-5 bg-gray-900 border-b border-gray-800 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Latest</span>
          </div>
          <p className={`${fontSizeClass} font-semibold leading-snug text-white`}>
            {lastText}
          </p>
        </div>
      )}

      {/* Song mode overlay — replaces translation feed when a song is active */}
      {activeSong ? (
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-blue-950 to-purple-950 px-6 py-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Now Singing</span>
            </div>
            <h2 className={`${fontSizeClass} font-bold text-white mb-1`}>{activeSong.song_title_en}</h2>
            <p className="text-blue-300 text-sm">{activeSong.song_title}</p>
          </div>

          <div className="space-y-6">
            {[...activeSong.sections]
              .sort((a, b) => a.section_number - b.section_number)
              .map((section) => (
                <div key={section.section_number}>
                  <div className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">
                    {section.section_name}
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className={`${fontSizeClass} leading-relaxed text-white whitespace-pre-wrap`}>
                      {section.text_target || section.text_source}
                    </p>
                    {section.text_target && section.text_source && (
                      <p className={`${sourceSizeClass} text-blue-200 mt-3 italic whitespace-pre-wrap`}>
                        {section.text_source}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        /* Normal translation feed */
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {status === "connecting" && translations.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-500">
              <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
              <p className="text-sm">Connecting to translation stream...</p>
            </div>
          )}

          {status === "ended" && (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-500">
              <p className="text-lg">Service has ended</p>
              <p className="text-sm">Thank you for joining</p>
            </div>
          )}

          {[...translations].reverse().map((t) => (
            <div key={t.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${CONTENT_COLORS[t.content_type]}`}>
                  {CONTENT_LABELS[t.content_type]}
                </span>
                <span className="text-xs text-gray-600">
                  {new Date(t.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className={`${fontSizeClass} leading-snug text-gray-100`}>
                {t.target_text}
              </p>
              {t.source_text && (
                <p className={`${sourceSizeClass} text-gray-500 italic`}>
                  {t.source_text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
