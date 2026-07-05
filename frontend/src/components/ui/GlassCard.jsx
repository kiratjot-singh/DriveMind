import React from "react";

/**
 * Glassmorphism card wrapper with subtle top border glow.
 * @param {string} glowColor - CSS color for the top accent line
 * @param {string} className - Additional classes
 */
export default function GlassCard({
  children,
  glowColor,
  className = "",
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-[var(--dm-surface)]/80 backdrop-blur-md border border-[var(--dm-border)] rounded-2xl overflow-hidden transition-all duration-200 hover:border-[var(--dm-primary)]/30 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {glowColor && (
        <div
          className="absolute top-0 inset-x-0 h-px rounded-t-2xl"
          style={{
            background: `linear-gradient(90deg, transparent, ${glowColor}60, transparent)`,
          }}
        />
      )}
      {children}
    </div>
  );
}
