import React from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  color?: string;
}

export function StatCard({ label, value, color = "bg-blue-600" }: StatCardProps) {
  return (
    <div className={`${color} rounded shadow p-6 flex flex-col items-center`}>
      <div className="text-4xl font-extrabold text-white drop-shadow-sm">{value}</div>
      <div className="text-blue-100 mt-1 font-medium tracking-wide">{label}</div>
    </div>
  );
}
