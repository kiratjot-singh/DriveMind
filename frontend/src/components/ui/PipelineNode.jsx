import React from "react";
import { motion } from "framer-motion";

/**
 * Single step in the pipeline visualization.
 * @param {string} icon - Emoji icon
 * @param {string} label - Step name
 * @param {"idle"|"active"|"done"|"failed"|"degraded"} status
 * @param {number|null} ms - Execution time in ms
 */
export default function PipelineNode({ icon, label, status = "idle", ms = null }) {
  const statusConfig = {
    idle:     { bg: "bg-[var(--dm-bg)]", border: "border-[var(--dm-border)]", text: "text-[var(--dm-dark-muted)]", badge: "Idle", badgeColor: "text-[var(--dm-dark-muted)]" },
    active:   { bg: "bg-indigo-500/15", border: "border-indigo-500/60", text: "text-indigo-300", badge: "Active", badgeColor: "text-indigo-400" },
    done:     { bg: "bg-emerald-500/8",  border: "border-emerald-500/30", text: "text-emerald-400", badge: "OK", badgeColor: "text-emerald-400" },
    failed:   { bg: "bg-red-500/15",     border: "border-red-500/60", text: "text-red-300", badge: "Failed", badgeColor: "text-red-400" },
    degraded: { bg: "bg-amber-500/12",   border: "border-amber-500/50", text: "text-amber-300", badge: "Degraded", badgeColor: "text-amber-400" },
  };

  const cfg = statusConfig[status] || statusConfig.idle;

  return (
    <motion.div
      animate={status === "active" ? { scale: 1.06 } : { scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-xl border text-center flex-shrink-0 min-w-[80px] transition-all duration-300 ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[9px] font-bold leading-tight">{label}</span>
      <span className={`text-[8px] font-mono uppercase ${cfg.badgeColor}`}>
        {ms !== null ? `${ms}ms` : cfg.badge}
      </span>
    </motion.div>
  );
}
