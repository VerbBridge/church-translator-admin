"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useStore, mapBackendSession, type BackendSession } from "@/lib/store";
import { LiveSession } from "./live-session";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ActiveSessionPage() {
  const { id } = useParams();
  const session = useStore((state) => state.sessions.find((s) => s.id === id));
  const addSession = useStore((state) => state.addSession);
  const [deviceId, setDeviceId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadSession = async () => {
    if (!id) return;

    // If session is already in store, no need to fetch
    if (session) {
      setIsLoading(false);
      setFetchError(null);
      return;
    }

    try {
      setIsLoading(true);
      setFetchError(null);
      const backendSession = await api.getSession(id as string) as BackendSession;
      const storedDeviceId = localStorage.getItem(`session_${id}_deviceId`) || undefined;
      const mapped = mapBackendSession(backendSession, storedDeviceId);
      addSession(mapped);
    } catch (err) {
      console.error('[ActiveSessionPage] Failed to fetch session from backend:', err);
      setFetchError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [id, session, addSession]);

  // Resolve device ID from session or localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && id && session) {
      const sessionDeviceId = session.deviceId;
      const storedDeviceId = localStorage.getItem(`session_${id}_deviceId`);
      const finalDeviceId = sessionDeviceId || storedDeviceId || "";
      setDeviceId(finalDeviceId);
    }
  }, [id, session]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center text-gray-500">
        Loading session...
      </div>
    );
  }

  if (fetchError || !session) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <div className="bg-red-50 border border-red-200 rounded p-6 text-red-800">
          <h2 className="text-lg font-semibold mb-2">
            {fetchError ? "Failed to Load Session" : "Session Not Found"}
          </h2>
          <p className="mb-4 text-sm">
            {fetchError || "This session does not exist or has been deleted."}
          </p>
          <div className="flex gap-3 justify-center">
            {fetchError && (
              <button
                onClick={() => loadSession()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold text-sm"
              >
                Retry
              </button>
            )}
            <Link
              href="/sessions"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-semibold text-sm"
            >
              Back to Sessions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!deviceId) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded p-6 text-yellow-800">
          <h2 className="text-lg font-semibold mb-2">No Audio Device Selected</h2>
          <p className="mb-4">This session doesn&apos;t have an audio device configured.</p>
          <p className="text-sm">Please create a new session and select an audio device.</p>
        </div>
      </div>
    );
  }

  return (
    <LiveSession
      sessionId={session.id}
      sessionName={session.name}
      deviceId={deviceId}
      startedAt={session.startedAt}
      sourceLanguage={session.sourceLanguage || "es"}
      targetLanguage={session.targetLanguage || "en"}
    />
  );
}
