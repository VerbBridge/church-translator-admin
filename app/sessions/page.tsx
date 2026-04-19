"use client";


import { useEffect, useState } from "react";
import { useStore, mapBackendSession, type BackendSession } from "@/lib/store";
import { SessionRow } from "@/components/SessionRow";
import Link from "next/link";
import { api } from "@/lib/api";

export default function SessionsPage() {
  const sessions = useStore((state) => state.sessions);
  const setSessions = useStore((state) => state.setSessions);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        setIsLoading(true);
        setError(null);
        const backendSessions = await api.getSessions() as BackendSession[];

        // Get current sessions from store at the time of loading
        const currentSessions = sessions;

        // Merge backend data with existing store data to preserve translations
        const mappedSessions = backendSessions.map((backendSession) => {
          // Find existing session in current store
          const existingSession = currentSessions.find((s) => s.id === backendSession.id);

          // Map backend session
          const newSession = mapBackendSession(backendSession);

          // Preserve translations and other frontend-only data if session exists
          if (existingSession) {
            return {
              ...newSession,
              translations: existingSession.translations || [],
              deviceId: existingSession.deviceId,
            };
          }

          return newSession;
        });

        setSessions(mappedSessions);
      } catch (err) {
        console.error("Failed to load sessions:", err);
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      } finally {
        setIsLoading(false);
      }
    }

    // Only load once on mount
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Link href="/sessions/new">
          <button className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition font-semibold">
            + New Session
          </button>
        </Link>
      </div>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}
      <div className="bg-white rounded shadow divide-y">
        {isLoading ? (
          <div className="px-4 py-6 text-gray-500 text-center">Loading sessions...</div>
        ) : sessions.length > 0 ? (
          sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="block hover:bg-gray-50 transition"
            >
              <SessionRow
                name={session.name}
                startedAt={session.startedAt}
                status={session.status}
                connectedUsers={session.connectedUsers}
              />
            </Link>
          ))
        ) : (
          <div className="px-4 py-6 text-gray-400 text-center">No sessions found.</div>
        )}
      </div>
    </div>
  );
}
