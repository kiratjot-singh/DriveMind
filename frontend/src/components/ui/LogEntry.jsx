import React from "react";

/**
 * Formatted log line for the terminal-style log feed.
 * @param {string} time - Timestamp
 * @param {string} category - Module name
 * @param {string} message - Log content
 * @param {"info"|"success"|"warning"|"error"} status
 */
export default function LogEntry({ time, category, message, status = "info" }) {
  const badgeStyles = {
    error:   "bg-red-500/10   text-red-400   border-red-900/40",
    warning: "bg-amber-500/10 text-amber-400 border-amber-900/40",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-900/40",
    info:    "bg-slate-800    text-slate-500 border-slate-700",
  };

  return (
    <div className="flex items-start gap-2 animate-slide-up">
      <span className="text-[var(--dm-dark-muted)] flex-shrink-0 text-[10px] font-mono">[{time}]</span>
      <span
        className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${badgeStyles[status] || badgeStyles.info}`}
      >
        {category}
      </span>
      <span className="text-slate-400 break-all flex-1 text-[10px]">{message}</span>
    </div>
  );
}
