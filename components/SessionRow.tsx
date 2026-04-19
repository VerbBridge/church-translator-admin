import React from "react";

interface SessionRowProps {
  name: string;
  startedAt: string;
  status: string;
  connectedUsers: number;
}

export function SessionRow({ name, startedAt, status, connectedUsers }: SessionRowProps) {
  const date = new Date(startedAt);
  const formatted = date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <div>
        <div className="font-semibold text-base text-gray-900">{name}</div>
        <div className="text-xs text-gray-400 mt-0.5">{formatted}</div>
        <div className="text-xs text-gray-400">{status === "ended" ? "Ended" : "Active"}</div>
      </div>
      <div className="text-sm text-gray-600">{connectedUsers} users</div>
    </div>
  );
}
