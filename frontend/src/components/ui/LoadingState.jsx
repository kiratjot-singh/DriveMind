import React from "react";

/**
 * Loading skeleton state.
 * @param {string} message - Optional loading message
 * @param {"spinner"|"skeleton"} variant
 */
export default function LoadingState({ message = "Loading…", variant = "spinner" }) {
  if (variant === "skeleton") {
    return (
      <div className="space-y-3 animate-pulse p-4">
        <div className="h-4 bg-[var(--dm-surface)] rounded-lg w-3/4" />
        <div className="h-4 bg-[var(--dm-surface)] rounded-lg w-1/2" />
        <div className="h-20 bg-[var(--dm-surface)] rounded-xl" />
        <div className="h-4 bg-[var(--dm-surface)] rounded-lg w-2/3" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-8 h-8 border-3 border-[var(--dm-border)] border-t-[var(--dm-primary)] rounded-full animate-spin mb-3" />
      <p className="text-sm text-[var(--dm-muted)] font-semibold">{message}</p>
    </div>
  );
}
