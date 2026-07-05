import React from "react";

/**
 * Reusable KPI metric card.
 * @param {string} label - Small uppercase label
 * @param {string|number} value - Main value
 * @param {string} sub - Small sublabel
 * @param {string} color - CSS color for the value
 */
export default function MetricCard({ label, value, sub, color = "var(--dm-text)" }) {
  return (
    <div className="bg-[var(--dm-surface)] border border-[var(--dm-border)] rounded-2xl p-4 transition-colors hover:border-[var(--dm-primary)]/30">
      <p className="text-[9px] text-[var(--dm-muted)] font-bold uppercase tracking-wider leading-none mb-2">
        {label}
      </p>
      <p
        className="text-xl font-black leading-none capitalize truncate"
        style={{ color }}
      >
        {String(value).length > 12 ? String(value).slice(0, 11) + "…" : value}
      </p>
      {sub && (
        <p className="text-[9px] text-[var(--dm-dark-muted)] font-mono mt-1">{sub}</p>
      )}
    </div>
  );
}
