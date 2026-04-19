"use client";

interface AudioLevelMeterProps {
  rms: number;
  maxRms?: number;
}

export function AudioLevelMeter({ rms, maxRms = 0.1 }: AudioLevelMeterProps) {
  const percentage = Math.min(100, (rms / maxRms) * 100);

  // Color based on level
  let barColor = "bg-green-500";
  if (percentage > 60) barColor = "bg-yellow-500";
  if (percentage > 80) barColor = "bg-red-500";

  // Convert to dB for display
  const db = rms > 0 ? Math.round(20 * Math.log10(rms)) : -Infinity;
  const dbDisplay = db === -Infinity ? "-∞ dB" : `${db} dB`;

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-100 ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="text-sm font-mono text-gray-700 w-28 text-right">
          {rms.toFixed(4)} RMS
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-1 text-right">
        {dbDisplay}
      </div>
    </div>
  );
}
