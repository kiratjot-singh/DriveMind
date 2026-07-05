import React from "react";

/**
 * Empty state placeholder with icon and message.
 * @param {string} icon - Emoji or text icon
 * @param {string} title
 * @param {string} message
 */
export default function EmptyState({ icon = "📋", title = "No data", message = "" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <span className="text-5xl mb-3 opacity-20">{icon}</span>
      <p className="text-sm font-bold text-[var(--dm-muted)]">{title}</p>
      {message && (
        <p className="text-[11px] text-[var(--dm-dark-muted)] mt-1 max-w-[220px] leading-relaxed">
          {message}
        </p>
      )}
    </div>
  );
}
