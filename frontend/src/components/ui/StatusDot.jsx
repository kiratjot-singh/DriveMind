import React from "react";

/**
 * Animated status indicator dot.
 * @param {"connected"|"degraded"|"disconnected"} status
 */
export default function StatusDot({ status = "disconnected", size = "w-2.5 h-2.5" }) {
  const colors = {
    connected:    "bg-emerald-400",
    degraded:     "bg-amber-400",
    disconnected: "bg-red-500",
  };
  const shouldPulse = status === "connected" || status === "degraded";

  return (
    <span className={`${size} rounded-full flex-shrink-0 ${colors[status] || colors.disconnected} ${shouldPulse ? "animate-pulse" : ""}`} />
  );
}
