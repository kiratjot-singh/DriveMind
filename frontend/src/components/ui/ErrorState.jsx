import React from "react";

/**
 * Error state with retry button.
 * @param {string} title
 * @param {string} message
 * @param {Function} onRetry
 */
export default function ErrorState({ title = "Something went wrong", message = "", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mb-4">
        <span className="text-2xl">⚠</span>
      </div>
      <h3 className="text-sm font-bold text-red-400 mb-1">{title}</h3>
      {message && <p className="text-xs text-[var(--dm-muted)] max-w-xs leading-relaxed mb-4">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all"
        >
          ↻ Try Again
        </button>
      )}
    </div>
  );
}
