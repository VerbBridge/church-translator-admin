"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AudioDeviceSelector } from "@/components/AudioDeviceSelector";
import { AudioLevelMeter } from "@/components/AudioLevelMeter";
import { CalibrationClient } from "@/lib/calibration-client";
import { getChurchId } from "@/lib/api";

type CalibrationPhase = "idle" | "phase1_silence" | "phase2_speech" | "complete" | "saved";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function CalibrationPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<CalibrationPhase>("idle");
  const [deviceId, setDeviceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [currentRms, setCurrentRms] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [isSaving, setIsSaving] = useState(false);

  // Results
  const [noiseFloor, setNoiseFloor] = useState(0);
  const [speechLevel, setSpeechLevel] = useState(0);
  const [vadThreshold, setVadThreshold] = useState(0);

  // Refs for collecting RMS values during phases
  const silenceRmsRef = useRef<number[]>([]);
  const speechRmsRef = useRef<number[]>([]);
  const clientRef = useRef<CalibrationClient | null>(null);
  const phaseRef = useRef<CalibrationPhase>("idle");
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const handleAudioLevel = useCallback((rms: number) => {
    setCurrentRms(rms);

    if (phaseRef.current === "phase1_silence") {
      silenceRmsRef.current.push(rms);
    } else if (phaseRef.current === "phase2_speech") {
      speechRmsRef.current.push(rms);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setCurrentRms(0);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startCalibration = async () => {
    if (!deviceId) {
      setError("Please select an audio device first");
      return;
    }

    setError(null);
    silenceRmsRef.current = [];
    speechRmsRef.current = [];

    // Create and connect client
    const client = new CalibrationClient({
      churchId: getChurchId(),
      onAudioLevel: handleAudioLevel,
      onConnectionChange: () => {},
      onError: (err) => setError(err),
    });

    clientRef.current = client;

    try {
      await client.connect();
      await client.startAudioCapture(deviceId);
      startPhase1();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start calibration");
      cleanup();
    }
  };

  const startPhase1 = () => {
    setPhase("phase1_silence");
    setCountdown(5);

    let remaining = 5;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        startPhase2();
      }
    }, 1000);
  };

  const startPhase2 = () => {
    setPhase("phase2_speech");
    setCountdown(5);

    let remaining = 5;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        finishCalibration();
      }
    }, 1000);
  };

  const finishCalibration = () => {
    const nf = median(silenceRmsRef.current);
    const sl = median(speechRmsRef.current);
    const vt = Math.max(0.005, Math.min(0.05, nf + (sl - nf) * 0.3));

    setNoiseFloor(nf);
    setSpeechLevel(sl);
    setVadThreshold(vt);
    setPhase("complete");

    // Stop audio capture but keep connection for saving
    clientRef.current?.stopAudioCapture();
    setCurrentRms(0);
  };

  const handleSave = () => {
    if (!clientRef.current?.isConnected()) {
      setError("Not connected to server");
      return;
    }

    setIsSaving(true);
    clientRef.current.saveCalibration({
      noise_floor: noiseFloor,
      speech_level: speechLevel,
      vad_threshold: vadThreshold,
    });

    // Show success, then redirect after 2 seconds
    setTimeout(() => {
      setIsSaving(false);
      setPhase("saved");
      cleanup();
      setTimeout(() => {
        router.push("/settings");
      }, 2000);
    }, 500);
  };

  const handleCancel = () => {
    cleanup();
    setPhase("idle");
    setCurrentRms(0);
    setCountdown(5);
  };

  const handleRecalibrate = () => {
    cleanup();
    setPhase("idle");
    setCurrentRms(0);
    setCountdown(5);
    silenceRmsRef.current = [];
    speechRmsRef.current = [];
  };

  const dbDisplay = (rms: number) => {
    if (rms <= 0) return "-∞ dB";
    return `${Math.round(20 * Math.log10(rms))} dB`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/settings" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
          &larr; Back to Settings
        </Link>
        <h1 className="text-2xl font-bold">Audio Calibration</h1>
        <p className="text-gray-600 text-sm mt-1">
          Calibrate your microphone for accurate voice activity detection.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Idle - Device selection & start */}
      {phase === "idle" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Select Audio Device</h2>
            <AudioDeviceSelector onDeviceSelect={setDeviceId} />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800">
            <strong>How it works:</strong> This wizard will measure your room&apos;s
            ambient noise (5 seconds of silence) and your speech level (5 seconds of
            speaking) to automatically set the voice detection threshold.
          </div>

          <button
            onClick={startCalibration}
            disabled={!deviceId}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded shadow hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Calibration
          </button>
        </div>
      )}

      {/* Phase 1 - Silence */}
      {phase === "phase1_silence" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <div className="text-sm text-gray-500 font-semibold uppercase tracking-wide mb-1">
              Step 1 of 2
            </div>
            <h2 className="text-lg font-semibold">Measuring Ambient Noise</h2>
            <p className="text-gray-600 text-sm mt-1">
              Please stay quiet for 5 seconds so we can measure your room&apos;s
              background noise level.
            </p>
          </div>

          <AudioLevelMeter rms={currentRms} />

          <div className="text-center text-2xl font-bold text-gray-700">
            {countdown} seconds remaining...
          </div>

          <button
            onClick={handleCancel}
            className="w-full bg-gray-400 text-white px-6 py-2 rounded shadow hover:bg-gray-500 transition font-semibold"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Phase 2 - Speech */}
      {phase === "phase2_speech" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <div className="text-sm text-gray-500 font-semibold uppercase tracking-wide mb-1">
              Step 2 of 2
            </div>
            <h2 className="text-lg font-semibold">Measuring Speech Level</h2>
            <p className="text-gray-600 text-sm mt-1">
              Please speak normally into your microphone for 5 seconds (read a Bible
              verse, count to ten, etc.)
            </p>
          </div>

          <AudioLevelMeter rms={currentRms} />

          <div className="text-center text-2xl font-bold text-gray-700">
            {countdown} seconds remaining...
          </div>

          <button
            onClick={handleCancel}
            className="w-full bg-gray-400 text-white px-6 py-2 rounded shadow hover:bg-gray-500 transition font-semibold"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Complete - Results */}
      {phase === "complete" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-2">&#10003;</div>
            <h2 className="text-xl font-bold">Calibration Complete!</h2>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-700">Results</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Ambient Noise</div>
                <div className="font-mono font-semibold text-gray-900">
                  {noiseFloor.toFixed(4)} RMS ({dbDisplay(noiseFloor)})
                </div>
              </div>
              <div>
                <div className="text-gray-500">Speech Level</div>
                <div className="font-mono font-semibold text-gray-900">
                  {speechLevel.toFixed(4)} RMS ({dbDisplay(speechLevel)})
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-gray-500">VAD Threshold (auto-calculated)</div>
                <div className="font-mono font-semibold text-lg text-blue-700">
                  {vadThreshold.toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRecalibrate}
              className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded shadow hover:bg-gray-300 transition font-semibold"
            >
              Re-calibrate
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded shadow hover:bg-green-700 transition font-semibold disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Saved - Success confirmation */}
      {phase === "saved" && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-3xl">&#10003;</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Settings Saved!</h2>
            <p className="text-gray-600 text-sm mt-2">
              Your calibration settings have been saved successfully.
              Redirecting to settings...
            </p>
          </div>
          <div className="flex justify-center">
            <Link
              href="/settings"
              className="text-blue-600 hover:underline text-sm font-semibold"
            >
              Go to Settings now
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
