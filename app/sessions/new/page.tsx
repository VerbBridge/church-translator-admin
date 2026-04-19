"use client";


import { useState } from "react";
import { useStore, mapBackendSession, type BackendSession } from "@/lib/store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AudioDeviceSelector } from "@/components/AudioDeviceSelector";
import { api, getChurchId } from "@/lib/api";

export default function NewSessionPage() {
  const [name, setName] = useState("");
  const addSession = useStore((state) => state.addSession);
  const router = useRouter();
  const [deviceId, setDeviceId] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<"es" | "en">("es");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetLanguage = sourceLanguage === "es" ? "en" : "es";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !deviceId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Call backend API to create session
      const backendSession = await api.createSession({
        name: name.trim(),
        church_id: getChurchId(),
        source_language: sourceLanguage,
        target_language: targetLanguage,
      }) as BackendSession;

      // Map backend response to frontend format and include deviceId
      const newSession = mapBackendSession(backendSession, deviceId);

      // Save device ID to localStorage for this session
      localStorage.setItem(`session_${newSession.id}_deviceId`, deviceId);

      // Add to local store
      addSession(newSession);

      // Navigate directly to the new session detail page
      router.push(`/sessions/${newSession.id}`);
    } catch (err) {
      console.error("Failed to create session:", err);
      setError(err instanceof Error ? err.message : "Failed to create session. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Session</h1>
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
        <strong>Audio Setup Instructions:</strong>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>Connect your church audio mixer's output (e.g., XLR, 1/4" TRS, or RCA) to a USB audio interface.</li>
          <li>Plug the USB audio interface into this computer.</li>
          <li>Allow browser microphone access if prompted.</li>
          <li>Select the USB audio interface from the "Audio Input Device" dropdown below.</li>
        </ol>
        <div className="mt-2 text-xs text-blue-700">Need help? Ask your tech team or see the user guide.</div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded shadow p-8">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
        <div>
          <label className="block text-base font-bold mb-2 text-gray-900">Session Name</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring focus:border-blue-400"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunday Service - December 28, 2025"
            required
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-base font-bold mb-2 text-gray-900">Translation Direction</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSourceLanguage("es")}
              className={`p-4 rounded border-2 text-left transition ${
                sourceLanguage === "es"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              disabled={isLoading}
            >
              <div className="font-semibold text-gray-900">Spanish &rarr; English</div>
              <div className="text-xs text-gray-500 mt-1">Pastor speaks Spanish, translate to English</div>
            </button>
            <button
              type="button"
              onClick={() => setSourceLanguage("en")}
              className={`p-4 rounded border-2 text-left transition ${
                sourceLanguage === "en"
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              disabled={isLoading}
            >
              <div className="font-semibold text-gray-900">English &rarr; Spanish</div>
              <div className="text-xs text-gray-500 mt-1">Pastor speaks English, translate to Spanish</div>
            </button>
          </div>
        </div>
        <AudioDeviceSelector onDeviceSelect={setDeviceId} />
        <div className="flex gap-4 justify-end">
          <Link href="/sessions">
            <button type="button" className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700" disabled={isLoading}>Cancel</button>
          </Link>
          <button
            type="submit"
            className="px-6 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
            disabled={!deviceId || isLoading}
          >
            {isLoading ? "Creating..." : "Start Session"}
          </button>
        </div>
      </form>
    </div>
  );
}
