import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";

// ── 3D Background Globe ────────────────────────────────

function RotatingGlobe() {
  const meshRef = useRef();
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.08;
      meshRef.current.rotation.x += delta * 0.02;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2.2, 1]} />
      <meshBasicMaterial color="#4F46E5" wireframe opacity={0.08} transparent />
    </mesh>
  );
}

function GlobeBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none opacity-40">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <RotatingGlobe />
      </Canvas>
    </div>
  );
}

// ── Card animation variants ────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" },
  }),
};

// ── Main Component ─────────────────────────────────────

function PortalSelect({ onSelectPortal }) {
  return (
    <div className="min-h-screen bg-[var(--dm-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* 3D Globe background */}
      <GlobeBackground />

      {/* Ambient glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[560px] h-[560px] rounded-full bg-indigo-500/[0.05] blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[560px] h-[560px] rounded-full bg-cyan-500/[0.05] blur-[120px] pointer-events-none" />

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-14 z-10"
      >
        <div className="inline-flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <span className="text-white font-black text-lg leading-none">D</span>
          </div>
          <span className="text-xl font-black tracking-tight text-[var(--dm-text)]">DriveMind</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[var(--dm-text)] mb-3 leading-none">
          Collective Vehicle
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
            Intelligence Platform
          </span>
        </h1>
        <p className="text-[var(--dm-muted)] text-sm sm:text-base max-w-md mx-auto leading-relaxed">
          Select your portal to access the DriveMind V2X safety network.
        </p>
      </motion.div>

      {/* ── Portal Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl w-full z-10">

        {/* Admin Card */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          onClick={() => onSelectPortal("admin")}
          className="group relative bg-[var(--dm-surface)] border border-[var(--dm-border)] hover:border-indigo-500/60 rounded-3xl p-8 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col"
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent rounded-t-3xl" />

          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 group-hover:bg-indigo-500/15 transition-colors">
            <span className="text-2xl">📊</span>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Admin Access
          </span>

          <h2 className="text-xl font-black text-[var(--dm-text)] mb-2 group-hover:text-indigo-300 transition-colors">
            Operations Center
          </h2>
          <p className="text-[var(--dm-muted)] text-sm leading-relaxed flex-1 mb-6">
            System health, pipeline monitoring, AI explainability, road risk heatmap, Neo4j graph, and live analytics.
          </p>

          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm group-hover:gap-3 transition-all">
            <span>Enter Admin Portal</span>
            <span>→</span>
          </div>
        </motion.div>

        {/* Vehicle Card */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          onClick={() => onSelectPortal("vehicle")}
          className="group relative bg-[var(--dm-surface)] border border-[var(--dm-border)] hover:border-cyan-500/60 rounded-3xl p-8 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/10 flex flex-col"
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent rounded-t-3xl" />

          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6 group-hover:bg-cyan-500/15 transition-colors">
            <span className="text-2xl">🚗</span>
          </div>

          <span className="inline-flex w-fit items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Driver Portal
          </span>

          <h2 className="text-xl font-black text-[var(--dm-text)] mb-2 group-hover:text-cyan-300 transition-colors">
            Connected Vehicle Cockpit
          </h2>
          <p className="text-[var(--dm-muted)] text-sm leading-relaxed flex-1 mb-6">
            Real-time risk alerts, recommended safety actions, V2V proximity warnings, and vehicle infotainment display.
          </p>

          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm group-hover:gap-3 transition-all">
            <span>Enter Driver Cockpit</span>
            <span>→</span>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-[var(--dm-dark-muted)] text-xs mt-12 z-10"
      >
        DriveMind V2X Safety Network · Real-time Collective Intelligence
      </motion.p>
    </div>
  );
}

export default PortalSelect;
