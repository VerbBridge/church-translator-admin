"use client";

import { useState, useEffect } from "react";

interface AudioDeviceSelectorProps {
  onDeviceSelect: (deviceId: string) => void;
}

export function AudioDeviceSelector({ onDeviceSelect }: AudioDeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState("");

  useEffect(() => {
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
        setDevices(audioInputs);
        if (audioInputs.length > 0) {
          setSelectedDevice(audioInputs[0].deviceId);
          onDeviceSelect(audioInputs[0].deviceId);
        }
      } catch (error) {
        setDevices([]);
      }
    }
    getDevices();
  }, [onDeviceSelect]);

  return (
    <div className="space-y-2">
      <label className="text-base font-bold text-gray-900">Audio Input Device</label>
      <select
        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
        value={selectedDevice}
        onChange={(e) => {
          setSelectedDevice(e.target.value);
          onDeviceSelect(e.target.value);
        }}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Device ${device.deviceId.slice(0, 8)}`}
          </option>
        ))}
      </select>
      {devices.length === 0 && (
        <p className="text-sm text-gray-400">No audio devices found. Check browser permissions.</p>
      )}
    </div>
  );
}
