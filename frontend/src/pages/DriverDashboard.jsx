import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { sendTelemetry } from "../api/backendApi";
import { socket } from "../socket/socketClient";
import GlassCard from "../components/ui/GlassCard";
import EmptyState from "../components/ui/EmptyState";

// ── Config ───────────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  low:      { label: "ALL CLEAR", color: "#22C55E", dim: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.35)", icon: "✓", pulse: false },
  medium:   { label: "CAUTION",   color: "#F59E0B", dim: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)", icon: "⚡", pulse: false },
  high:     { label: "HIGH RISK", color: "#F97316", dim: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.45)", icon: "⚠", pulse: true },
  critical: { label: "CRITICAL",  color: "#EF4444", dim: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.55)", icon: "🚨", pulse: true },
};

const ACTION_LABELS = {
  emergency_brake: "EMERGENCY BRAKE", brake: "BRAKE", reduce_speed: "REDUCE SPEED",
  slow_down: "SLOW DOWN", change_lane: "CHANGE LANE", increase_following_distance: "INCREASE DISTANCE",
  continue_normal_driving: "ALL CLEAR", maintain_speed: "MAINTAIN SPEED",
  reduce_speed_immediately_and_increase_following_distance: "REDUCE SPEED NOW",
  reduce_speed_by_25_percent: "SLOW DOWN 25%", drive_with_caution: "DRIVE WITH CAUTION",
};

const WEATHER_ICONS = { clear: "☀️", rain: "🌧️", fog: "🌫️", snow: "❄️" };
const SEGMENTS = ["curve_42", "highway_101", "sec_17", "sec_15", "pec_gate", "tribune_chowk", "airport_road"];
const ADJACENCY = {
  curve_42: ["highway_101"], highway_101: ["curve_42", "sec_17"], sec_17: ["highway_101"],
  sec_15: ["pec_gate"], pec_gate: ["sec_15"], tribune_chowk: ["airport_road"], airport_road: ["tribune_chowk"],
};

// ── 3D Vehicle Model ─────────────────────────────────────────────────────────

function VehicleModel({ riskColor }) {
  const ref = useRef();
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.3; });
  return (
    <group ref={ref} scale={0.7}>
      {/* Body */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.4, 0.4, 0.7]} />
        <meshBasicMaterial color={riskColor} wireframe opacity={0.35} transparent />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.8, 0.35, 0.6]} />
        <meshBasicMaterial color={riskColor} wireframe opacity={0.25} transparent />
      </mesh>
      {/* Wheels */}
      {[[-0.5, -0.15, 0.4], [0.5, -0.15, 0.4], [-0.5, -0.15, -0.4], [0.5, -0.15, -0.4]].map((pos, i) => (
        <mesh key={i} position={pos} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.06, 8]} />
          <meshBasicMaterial color={riskColor} wireframe opacity={0.4} transparent />
        </mesh>
      ))}
    </group>
  );
}

// ── Gauges ────────────────────────────────────────────────────────────────────

function SpeedGauge({ speed, max = 120 }) {
  const r = 52, circ = 2 * Math.PI * r, visibleArc = (270 / 360) * circ;
  const fill = Math.min(1, speed / max) * visibleArc;
  const color = speed > 80 ? "#EF4444" : speed > 60 ? "#F59E0B" : "#4F46E5";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full" style={{ transform: "rotate(-135deg)" }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--dm-border)" strokeWidth="9" strokeDasharray={`${visibleArc} ${circ}`} strokeLinecap="round" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9" strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.3s ease" }} />
        </svg>
        <div className="flex flex-col items-center z-10">
          <span className="text-3xl font-black leading-none" style={{ color }}>{speed}</span>
          <span className="text-[10px] text-[var(--dm-muted)] font-semibold mt-0.5">km/h</span>
        </div>
      </div>
      <span className="text-[11px] text-[var(--dm-muted)] font-bold uppercase tracking-wider">Speed</span>
    </div>
  );
}

function DistanceBar({ distance, max = 100 }) {
  const pct = Math.min(100, (distance / max) * 100);
  const critical = distance < 10, warning = distance < 25;
  const color = critical ? "#EF4444" : warning ? "#F59E0B" : "#22C55E";
  return (
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-[var(--dm-muted)] font-bold uppercase tracking-wider">Front Gap</span>
        <span className="font-black text-sm" style={{ color }}>{distance} m</span>
      </div>
      <div className="w-full h-3 bg-[var(--dm-bg)] rounded-full overflow-hidden border border-[var(--dm-border)]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color, boxShadow: critical ? `0 0 8px ${color}` : "none" }} />
      </div>
      {critical && <span className="text-[10px] text-red-400 font-bold animate-pulse">⚠ TOO CLOSE!</span>}
    </div>
  );
}

function SteeringIndicator({ angle }) {
  const color = Math.abs(angle) > 30 ? "#F59E0B" : "#4F46E5";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-[var(--dm-muted)] font-bold uppercase tracking-wider">Steering</span>
        <span className="font-black text-sm" style={{ color }}>{angle}°</span>
      </div>
      <div className="relative w-full h-3 bg-[var(--dm-bg)] rounded-full border border-[var(--dm-border)]">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--dm-border)]" />
        <div className="absolute top-1 bottom-1 w-3 rounded-full transition-all duration-300" style={{ left: `${50 + (angle / 45) * 40}%`, transform: "translateX(-50%)", backgroundColor: color }} />
      </div>
      <div className="flex justify-between"><span className="text-[9px] text-[var(--dm-dark-muted)]">◀ L</span><span className="text-[9px] text-[var(--dm-dark-muted)]">R ▶</span></div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function DriverDashboard({ onLogout }) {
  const myVehicleId = localStorage.getItem("active_vehicle_id") || "vehicle_demo_01";

  const [speed, setSpeed] = useState(45);
  const [steeringAngle, setSteeringAngle] = useState(0);
  const [brakePressure, setBrakePressure] = useState(0);
  const [laneOffset, setLaneOffset] = useState(0);
  const [distance, setDistance] = useState(55);
  const [acceleration, setAcceleration] = useState(0.1);
  const [weather, setWeather] = useState("clear");
  const [segment, setSegment] = useState("curve_42");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [lastProcessed, setLastProcessed] = useState(null);
  const [v2vAlerts, setV2vAlerts] = useState([]);
  const [connected, setConnected] = useState(socket.connected);
  const streamRef = useRef(null);

  const transmit = async (override = null) => {
    const payload = override || {
      vehicleId: myVehicleId, roadSegmentId: segment, speed: Number(speed),
      acceleration: Number(acceleration), brakePressure: Number(brakePressure),
      steeringAngle: Number(steeringAngle), laneOffset: Number(laneOffset),
      distanceToFrontVehicle: Number(distance), weather,
    };
    try { await sendTelemetry(payload); } catch (e) { /* silent */ }
  };

  useEffect(() => {
    if (isStreaming) { transmit(); streamRef.current = setInterval(transmit, 1000); }
    else { clearInterval(streamRef.current); }
    return () => clearInterval(streamRef.current);
  }, [isStreaming, speed, steeringAngle, brakePressure, laneOffset, distance, acceleration, weather, segment]);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onTelemetry = (data) => {
      setLastProcessed(data);
      if (data.vehicleId !== myVehicleId && data.risk?.riskScore >= 0.6) {
        setV2vAlerts((prev) => [{ ...data, receivedAt: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
      }
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("telemetry-processed", onTelemetry);
    return () => { socket.off("connect", onConnect); socket.off("disconnect", onDisconnect); socket.off("telemetry-processed", onTelemetry); };
  }, [myVehicleId]);

  const simulateRisk = () => transmit({
    vehicleId: myVehicleId, roadSegmentId: "curve_42", speed: 90, acceleration: -2.0,
    brakePressure: 0.85, steeringAngle: 28, laneOffset: 0.7, distanceToFrontVehicle: 5, weather: "rain",
  });

  const emergencyBrake = () => { setBrakePressure(0.9); setAcceleration(-3.0); setSpeed((p) => Math.max(0, p - 35)); };

  const riskLevel = lastProcessed?.risk?.riskLevel || "low";
  const riskScore = lastProcessed?.risk?.riskScore || 0;
  const action = lastProcessed?.risk?.recommendedAction || "continue_normal_driving";
  const riskCfg = RISK_CONFIG[riskLevel] || RISK_CONFIG.low;
  const actionLabel = ACTION_LABELS[action] || action.replace(/_/g, " ").toUpperCase();

  const v2vProximity = (seg) => seg === segment ? "same" : (ADJACENCY[segment] || []).includes(seg) ? "adjacent" : "distant";

  return (
    <div className="min-h-screen bg-[var(--dm-bg)] text-[var(--dm-text)] flex flex-col">
      {/* ── Header ── */}
      <header className="bg-[var(--dm-surface)] border-b border-[var(--dm-border)] px-5 py-3.5 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-sm">🚗</div>
          <div>
            <h1 className="text-sm font-black tracking-tight leading-none">DriveMind Cockpit</h1>
            <p className="text-[10px] text-[var(--dm-muted)] mt-0.5">{myVehicleId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
            <span className={connected ? "text-emerald-400" : "text-red-400"}>{connected ? "Live" : "Offline"}</span>
          </div>
          <button onClick={simulateRisk} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all">🚨 Simulate Risk</button>
          <button onClick={onLogout} className="bg-[var(--dm-bg)] hover:bg-[var(--dm-surface-hover)] border border-[var(--dm-border)] text-[var(--dm-muted)] hover:text-[var(--dm-text)] text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all">Exit →</button>
        </div>
      </header>

      {/* ── Main Grid ── */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-7xl w-full mx-auto">
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Risk Status */}
          <div className="relative rounded-3xl p-6 flex flex-col items-center justify-center overflow-hidden border transition-all duration-700" style={{ backgroundColor: riskCfg.dim, borderColor: riskCfg.border, minHeight: "260px" }}>
            <div className="absolute inset-0 rounded-3xl transition-all duration-700" style={{ background: `radial-gradient(ellipse at 50% 50%, ${riskCfg.dim} 0%, transparent 70%)` }} />
            {riskCfg.pulse && (
              <>
                <div className="absolute rounded-full animate-ring-pulse-slow pointer-events-none" style={{ width: 280, height: 280, border: `1px solid ${riskCfg.color}30` }} />
                <div className="absolute rounded-full animate-ring-pulse pointer-events-none" style={{ width: 200, height: 200, border: `2px solid ${riskCfg.color}50` }} />
              </>
            )}
            {/* 3D Car */}
            <div className="absolute inset-0 pointer-events-none opacity-30">
              <Canvas camera={{ position: [0, 1.5, 3], fov: 35 }}>
                <ambientLight intensity={0.5} />
                <VehicleModel riskColor={riskCfg.color} />
              </Canvas>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={riskLevel} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }} transition={{ duration: 0.35 }} className="relative z-10 flex flex-col items-center">
                <div className="w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center mb-4 shadow-2xl" style={{ borderColor: riskCfg.color, backgroundColor: riskCfg.dim, boxShadow: `0 0 40px ${riskCfg.color}30` }}>
                  <span className="text-4xl leading-none">{riskCfg.icon}</span>
                </div>
                <h2 className="text-5xl sm:text-6xl font-black tracking-tight leading-none" style={{ color: riskCfg.color }}>{riskCfg.label}</h2>
                {lastProcessed && <p className="text-[var(--dm-muted)] text-xs mt-2 font-mono">Risk Score: {riskScore.toFixed(2)}</p>}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Recommended Action */}
          <AnimatePresence mode="wait">
            <motion.div key={action} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <GlassCard className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 border" style={{ borderColor: riskCfg.border, backgroundColor: riskCfg.dim }}>
                  {riskLevel === "low" ? "✓" : "⚠"}
                </div>
                <div>
                  <p className="text-[11px] text-[var(--dm-muted)] font-semibold uppercase tracking-widest">Recommended Action</p>
                  <h3 className="text-2xl font-black tracking-tight mt-0.5" style={{ color: riskCfg.color }}>{actionLabel}</h3>
                </div>
              </GlassCard>
            </motion.div>
          </AnimatePresence>

          {/* Gauges */}
          <GlassCard className="p-5">
            <p className="text-[11px] text-[var(--dm-muted)] font-bold uppercase tracking-widest mb-4">Live Vehicle Status</p>
            <div className="grid grid-cols-3 gap-4 items-center">
              <SpeedGauge speed={speed} />
              <DistanceBar distance={distance} />
              <SteeringIndicator angle={steeringAngle} />
            </div>
          </GlassCard>

          {/* Environment */}
          <div className="grid grid-cols-2 gap-4">
            <GlassCard className="p-4 flex items-center gap-3">
              <span className="text-3xl">{WEATHER_ICONS[weather] || "☀️"}</span>
              <div>
                <p className="text-[10px] text-[var(--dm-muted)] font-bold uppercase tracking-wider">Weather</p>
                <p className="text-sm font-black capitalize">{weather}</p>
              </div>
            </GlassCard>
            <GlassCard className="p-4 flex items-center gap-3">
              <span className="text-3xl">📍</span>
              <div>
                <p className="text-[10px] text-[var(--dm-muted)] font-bold uppercase tracking-wider">Segment</p>
                <p className="text-sm font-black capitalize">{segment.replace(/_/g, " ")}</p>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* RIGHT COLUMN: V2V Alerts */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {lastProcessed?.intentPrediction?.success && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
              <GlassCard glowColor="#4F46E5" className="p-4">
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-2">🤖 AI Safety Alert</p>
                <p className="text-sm font-bold capitalize">{lastProcessed.intentPrediction.predictedIntent?.replace(/_/g, " ") || "Normal"}</p>
                <p className="text-[11px] text-[var(--dm-muted)] mt-1">Confidence: {(lastProcessed.intentPrediction.confidence * 100).toFixed(0)}%</p>
              </GlassCard>
            </motion.div>
          )}

          <GlassCard className="p-5 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] text-[var(--dm-muted)] font-bold uppercase tracking-widest">V2V Alert Feed</p>
                <p className="text-[10px] text-[var(--dm-dark-muted)] mt-0.5">Nearby vehicle warnings</p>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Scanning
              </span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-auto max-h-[320px] pr-1">
              <AnimatePresence>
                {v2vAlerts.length > 0 ? v2vAlerts.map((alert, i) => {
                  const prox = v2vProximity(alert.roadSegmentId);
                  const isSame = prox === "same", isAdj = prox === "adjacent";
                  return (
                    <motion.div key={`${alert.vehicleId}-${alert.receivedAt}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ delay: i * 0.05 }}
                      className={`relative rounded-xl border p-3.5 overflow-hidden ${isSame ? "bg-red-500/10 border-red-500/40" : isAdj ? "bg-amber-500/10 border-amber-500/40" : "bg-[var(--dm-bg)] border-[var(--dm-border)]"}`}>
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: isSame ? "#EF4444" : isAdj ? "#F59E0B" : "var(--dm-dark-muted)" }} />
                      <div className="pl-2">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold ${isSame ? "text-red-300" : isAdj ? "text-amber-300" : "text-[var(--dm-muted)]"}`}>
                            {isSame ? "⚠ Same Segment!" : isAdj ? "⚡ Adjacent Segment" : "📡 Nearby Vehicle"}
                          </span>
                          <span className="text-[10px] text-[var(--dm-dark-muted)] font-mono">{alert.receivedAt}</span>
                        </div>
                        <p className="text-[11px] text-[var(--dm-muted)]">
                          <span className="font-bold text-slate-300">{alert.vehicleId}</span> · <span className="capitalize">{alert.roadSegmentId?.replace(/_/g, " ")}</span>
                        </p>
                      </div>
                    </motion.div>
                  );
                }) : (
                  <EmptyState icon="📡" title="Scanning Road Network" message="No nearby alerts detected" />
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        </div>
      </main>

      {/* ── Demo Controls ── */}
      <div className="border-t border-[var(--dm-border)] bg-[var(--dm-surface)]">
        <button onClick={() => setShowControls((v) => !v)} className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] text-[var(--dm-muted)] hover:text-slate-300 font-semibold uppercase tracking-widest cursor-pointer transition-colors">
          <span>{showControls ? "▲" : "▼"}</span><span>Demo Controls</span><span className="text-[9px] text-[var(--dm-dark-muted)]">(for testing)</span>
        </button>
        <AnimatePresence>
          {showControls && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
              <div className="px-5 pb-5 pt-1 max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                  {[
                    { label: `Speed ${speed} km/h`, min: 0, max: 120, value: speed, set: setSpeed, accent: "accent-indigo-500" },
                    { label: `Steering ${steeringAngle}°`, min: -45, max: 45, value: steeringAngle, set: setSteeringAngle, accent: "accent-purple-500" },
                    { label: `Brake ${(brakePressure * 100).toFixed(0)}%`, min: 0, max: 1, step: 0.05, value: brakePressure, set: setBrakePressure, accent: "accent-red-500" },
                    { label: `Gap ${distance} m`, min: 2, max: 100, value: distance, set: setDistance, accent: "accent-emerald-500" },
                  ].map((s) => (
                    <div key={s.label} className="bg-[var(--dm-bg)] rounded-xl p-2.5 border border-[var(--dm-border)]">
                      <label className="text-[9px] text-[var(--dm-muted)] font-bold uppercase tracking-wider block mb-1.5">{s.label}</label>
                      <input type="range" min={s.min} max={s.max} step={s.step || 1} value={s.value} onChange={(e) => s.set(Number(e.target.value))} className={`w-full ${s.accent}`} />
                    </div>
                  ))}
                  <div className="bg-[var(--dm-bg)] rounded-xl p-2.5 border border-[var(--dm-border)]">
                    <label className="text-[9px] text-[var(--dm-muted)] font-bold uppercase tracking-wider block mb-1.5">Weather</label>
                    <select value={weather} onChange={(e) => setWeather(e.target.value)} className="w-full bg-[var(--dm-surface)] border border-[var(--dm-border)] rounded text-xs text-slate-300 p-1 cursor-pointer">
                      {["clear", "rain", "fog", "snow"].map((w) => <option key={w} value={w}>{WEATHER_ICONS[w]} {w}</option>)}
                    </select>
                  </div>
                  <div className="bg-[var(--dm-bg)] rounded-xl p-2.5 border border-[var(--dm-border)]">
                    <label className="text-[9px] text-[var(--dm-muted)] font-bold uppercase tracking-wider block mb-1.5">Segment</label>
                    <select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-full bg-[var(--dm-surface)] border border-[var(--dm-border)] rounded text-xs text-slate-300 p-1 cursor-pointer">
                      {SEGMENTS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isStreaming} onChange={(e) => setIsStreaming(e.target.checked)} className="w-4 h-4 accent-indigo-500 rounded" />
                    <span className="text-xs text-[var(--dm-muted)] font-semibold">Auto-Stream (1Hz)</span>
                  </label>
                  <button onClick={() => transmit()} className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold px-3.5 py-1.5 rounded-lg cursor-pointer transition-all">Send Once</button>
                  <button onClick={emergencyBrake} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold px-4 py-1.5 rounded-lg cursor-pointer transition-all">🛑 Emergency Brake</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default DriverDashboard;
