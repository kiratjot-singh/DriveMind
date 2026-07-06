import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getHealthStatus,
  getAllExperiences,
  getGraphOverview,
  getExperienceStats,
  getSimilarSegments
} from "../api/backendApi";
import { socket } from "../socket/socketClient";
import RiskMap from "../components/RiskMap";
import GlassCard from "../components/ui/GlassCard";
import MetricCard from "../components/ui/MetricCard";
import StatusDot from "../components/ui/StatusDot";
import PipelineNode from "../components/ui/PipelineNode";
import LogEntry from "../components/ui/LogEntry";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";

// ── Tab Configuration ────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",   label: "Overview",   icon: "📊" },
  { id: "pipeline",   label: "Pipeline",   icon: "⚡" },
  { id: "ai",         label: "AI Model",   icon: "🤖" },
  { id: "memory",     label: "Memory",     icon: "🧠" },
  { id: "graph",      label: "Graph",      icon: "🕸️" },
  { id: "map",        label: "Risk Map",   icon: "🗺️" },
  { id: "logs",       label: "Live Logs",  icon: "📟" },
];

// ── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [health, setHealth] = useState(null);
  const [experiences, setExperiences] = useState([]);
  const [graphData, setGraphData] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);
  const [socketEvents, setSocketEvents] = useState([]);
  const [pipelineSteps, setPipelineSteps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [trackedVehicles, setTrackedVehicles] = useState(new Set());
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState(null);
  const logsEndRef = useRef(null);

  const [stats, setStats] = useState(null);
  const [similarSegments, setSimilarSegments] = useState([]);
  const [selectedDashboardSegment, setSelectedDashboardSegment] = useState("curve_42");

  // ── Helpers ──────────────────────────────────────────

  const addLog = (category, message, status = "info") => {
    setLogs((prev) => [
      ...prev.slice(-80),
      { time: new Date().toLocaleTimeString(), category, message, status },
    ]);
  };

  const statusFor = (s) =>
    s === "connected" ? "connected" : s === "warning" ? "degraded" : "disconnected";

  // ── Data Fetching ────────────────────────────────────

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, e, g, s, sim] = await Promise.allSettled([
        getHealthStatus(),
        getAllExperiences(),
        getGraphOverview(),
        getExperienceStats(),
        getSimilarSegments(selectedDashboardSegment)
      ]);
      if (h.status === "fulfilled") setHealth(h.value);
      if (e.status === "fulfilled" && e.value?.data) setExperiences(e.value.data);
      if (g.status === "fulfilled" && g.value?.data) setGraphData(g.value.data);
      if (s.status === "fulfilled" && s.value?.stats) setStats(s.value.stats);
      if (sim.status === "fulfilled" && sim.value?.data) setSimilarSegments(sim.value.data);
      addLog("System", "Data refresh completed", "success");
    } catch (err) {
      setError(err.message);
      addLog("System", `Data fetch failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(async () => {
      try {
        const h = await getHealthStatus();
        setHealth(h);
      } catch (_) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedDashboardSegment]);

  // ── Socket.IO ────────────────────────────────────────

  useEffect(() => {
    const onConnect = () => { setConnected(true); addLog("Socket", "Connected to backend", "success"); };
    const onDisconnect = () => { setConnected(false); addLog("Socket", "Disconnected", "error"); };

    const onTelemetry = (data) => {
      setLastEvent(data);
      setTrackedVehicles((prev) => new Set([...prev, data.vehicleId]));
      setSocketEvents((prev) => [data, ...prev].slice(0, 30));

      // Update pipeline steps from timing data
      const t = data.pipelineTiming || {};
      setPipelineSteps([
        { icon: "📡", label: "Telemetry", status: "done", ms: t.mongoWriteMs },
        { icon: "🤖", label: "AI Model",  status: t.aiDegraded ? "degraded" : "done", ms: t.aiMs },
        { icon: "⚠",  label: "Risk Calc", status: "done", ms: t.riskMs },
        { icon: "🧠", label: "Memory",    status: data.experienceCreated ? "done" : "idle", ms: t.mongoExpMs || null },
        { icon: "💾", label: "MongoDB",   status: "done", ms: (t.mongoWriteMs || 0) + (t.mongoExpMs || 0) },
        { icon: "🕸️", label: "Neo4j",     status: t.neo4jDegraded ? "degraded" : data.graphMemoryCreated ? "done" : "idle", ms: t.neo4jMs || null },
        { icon: "📡", label: "Socket.IO", status: "done", ms: t.socketMs },
        { icon: "📊", label: "Dashboard", status: "done", ms: null },
      ]);

      // Add to logs
      const riskLabel = data.risk?.riskLevel || "low";
      const logStatus = riskLabel === "critical" || riskLabel === "high" ? "warning" : "info";
      addLog("Pipeline", `${data.vehicleId} → ${data.roadSegmentId} · risk=${data.risk?.riskScore?.toFixed(2)} · ${riskLabel} · ${t.totalMs || "?"}ms`, logStatus);

      if (data.experienceCreated) {
        addLog("Memory", `Experience saved for ${data.vehicleId} at ${data.roadSegmentId}`, "success");
      }
      if (t.aiDegraded) {
        addLog("AI", "AI service degraded — using fallback prediction", "warning");
      }
      if (t.neo4jDegraded) {
        addLog("Neo4j", "Graph write degraded — experience not saved to Neo4j", "warning");
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("telemetry-processed", onTelemetry);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("telemetry-processed", onTelemetry);
    };
  }, []);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ── Computed KPIs ────────────────────────────────────

  const totalExperiences = experiences.length;
  const criticalCount = experiences.filter((e) => e.riskScore >= 0.8).length;
  const avgRisk = totalExperiences > 0
    ? (experiences.reduce((s, e) => s + (e.riskScore || 0), 0) / totalExperiences).toFixed(2)
    : "0.00";

  const segmentCounts = {};
  experiences.forEach((e) => { segmentCounts[e.roadSegmentId] = (segmentCounts[e.roadSegmentId] || 0) + 1; });
  const dangerousSegment = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const intentCounts = {};
  experiences.forEach((e) => { intentCounts[e.eventType] = (intentCounts[e.eventType] || 0) + 1; });
  const commonIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const weatherCounts = {};
  experiences.forEach((e) => { if (e.riskScore >= 0.6) weatherCounts[e.weather] = (weatherCounts[e.weather] || 0) + 1; });
  const riskyWeather = Object.entries(weatherCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  // ── Loading/Error States ──────────────────────────────

  if (loading && !health) {
    return (
      <div className="min-h-screen bg-[var(--dm-bg)] flex items-center justify-center">
        <LoadingState message="Initializing DriveMind Operations Center…" />
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="min-h-screen bg-[var(--dm-bg)] flex items-center justify-center">
        <ErrorState title="Connection Failed" message={error} onRetry={fetchAll} />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--dm-bg)] text-[var(--dm-text)] flex flex-col">
      {/* ═══ Header ═══ */}
      <header className="bg-[var(--dm-surface)] border-b border-[var(--dm-border)] px-5 py-3 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
            <span className="text-sm font-black text-indigo-400">D</span>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight leading-none">DriveMind Operations</h1>
            <p className="text-[10px] text-[var(--dm-muted)] mt-0.5">
              {health?.status === "ok" ? "All Systems Operational" : health?.status === "degraded" ? "Degraded Mode" : "Checking…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
            <span className={connected ? "text-emerald-400" : "text-red-400"}>{connected ? "Live" : "Offline"}</span>
          </div>
          <span className="text-[10px] text-[var(--dm-dark-muted)] font-mono">{trackedVehicles.size} vehicles</span>
          <button onClick={fetchAll} className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all">↻ Refresh</button>
          <button onClick={onLogout} className="bg-[var(--dm-bg)] hover:bg-[var(--dm-surface-hover)] border border-[var(--dm-border)] text-[var(--dm-muted)] hover:text-[var(--dm-text)] text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all">Exit →</button>
        </div>
      </header>

      {/* ═══ Tab Bar ═══ */}
      <div className="bg-[var(--dm-surface)] border-b border-[var(--dm-border)] px-5 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-bold cursor-pointer transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-[var(--dm-muted)] hover:text-[var(--dm-text)] hover:bg-[var(--dm-bg)]/50"
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Content ═══ */}
      <main className="flex-1 p-4 max-w-[1440px] w-full mx-auto overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {activeTab === "overview" && (
              <OverviewTab
                health={health}
                statusFor={statusFor}
                totalExperiences={totalExperiences}
                criticalCount={criticalCount}
                avgRisk={avgRisk}
                dangerousSegment={dangerousSegment}
                commonIntent={commonIntent}
                riskyWeather={riskyWeather}
                trackedVehicles={trackedVehicles}
                stats={stats}
                similarSegments={similarSegments}
                selectedDashboardSegment={selectedDashboardSegment}
                setSelectedDashboardSegment={setSelectedDashboardSegment}
              />
            )}
            {activeTab === "pipeline" && <PipelineTab steps={pipelineSteps} lastEvent={lastEvent} />}
            {activeTab === "ai" && <AITab lastEvent={lastEvent} />}
            {activeTab === "memory" && <MemoryTab experiences={experiences} selectedSegment={selectedSegment} setSelectedSegment={setSelectedSegment} />}
            {activeTab === "graph" && <GraphTab graphData={graphData} selectedNode={selectedGraphNode} setSelectedNode={setSelectedGraphNode} />}
            {activeTab === "map" && <MapTab experiences={experiences} lastEvent={lastEvent} setSelectedSegment={setSelectedSegment} setActiveTab={setActiveTab} />}
            {activeTab === "logs" && <LogsTab logs={logs} socketEvents={socketEvents} logsEndRef={logsEndRef} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Overview Tab ────────────────────────────────────────

function OverviewTab({ 
  health, 
  statusFor, 
  totalExperiences, 
  criticalCount, 
  avgRisk, 
  dangerousSegment, 
  commonIntent, 
  riskyWeather, 
  trackedVehicles,
  stats,
  similarSegments,
  selectedDashboardSegment,
  setSelectedDashboardSegment
}) {
  const services = health?.services || {};
  return (
    <div className="space-y-4">
      {/* System Health */}
      <div>
        <h2 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest mb-3">System Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: "Backend",  key: "backend" },
            { name: "AI Model", key: "ai" },
            { name: "MongoDB",  key: "mongodb" },
            { name: "Neo4j",    key: "neo4j" },
          ].map((svc) => {
            const s = services[svc.key] || {};
            return (
              <GlassCard key={svc.key} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--dm-text)]">{svc.name}</span>
                  <StatusDot status={statusFor(s.status)} />
                </div>
                <p className="text-[10px] text-[var(--dm-muted)] capitalize">{s.status || "unknown"}</p>
                {s.latency !== null && s.latency !== undefined && (
                  <p className="text-[10px] text-[var(--dm-dark-muted)] font-mono mt-0.5">{s.latency}ms</p>
                )}
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* KPIs */}
      <div>
        <h2 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest mb-3">Analytics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard label="Total Experiences" value={totalExperiences} color="var(--dm-text)" />
          <MetricCard label="Critical Events" value={criticalCount} color="var(--dm-danger)" />
          <MetricCard label="Avg Risk Score" value={avgRisk} color="var(--dm-warning)" />
          <MetricCard label="Riskiest Segment" value={dangerousSegment.replace(/_/g, " ")} color="var(--dm-accent)" />
          <MetricCard label="Common Intent" value={commonIntent.replace(/_/g, " ")} color="var(--dm-primary)" />
          <MetricCard label="Risky Weather" value={riskyWeather} color="var(--dm-warning)" />
          <MetricCard label="Active Vehicles" value={trackedVehicles.size} color="var(--dm-success)" />
        </div>
      </div>

      {/* SVG Charts & Similar segments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Historical Trends */}
        <GlassCard className="p-4 flex flex-col justify-between min-h-[220px]">
          <div>
            <h3 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest mb-1">Historical Risk Trends</h3>
            <p className="text-[10px] text-[var(--dm-dark-muted)] mb-3">Daily average risk values for the past 7 days</p>
          </div>

          {stats && stats.dailyTrends && stats.dailyTrends.length > 0 ? (
            <div className="h-[100px] flex items-end justify-between px-2 relative mt-2">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                <div className="border-t border-[var(--dm-text)] w-full"></div>
                <div className="border-t border-[var(--dm-text)] w-full"></div>
                <div className="border-t border-[var(--dm-text)] w-full"></div>
              </div>
              
              {stats.dailyTrends.map((day, idx) => {
                const heightPct = Math.round((day.avgRisk || 0) * 100);
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 mx-1 z-10">
                    <div className="text-[8px] text-cyan-400 font-mono mb-1">{(day.avgRisk || 0).toFixed(2)}</div>
                    <div 
                      className="w-full bg-indigo-500/80 rounded-t-sm transition-all duration-500"
                      style={{ height: `${Math.max(8, heightPct)}px` }}
                    ></div>
                    <span className="text-[8px] text-[var(--dm-muted)] mt-1.5 font-mono">{day._id.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--dm-dark-muted)] text-xs border border-dashed border-[var(--dm-border)] rounded-xl">
              No historical trend data logged yet. Playback some scenarios.
            </div>
          )}
        </GlassCard>

        {/* Similar Segment explorer */}
        <GlassCard className="p-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest mb-1">Similar Segment threats</h3>
              <p className="text-[10px] text-[var(--dm-dark-muted)]">Sectors matching current hazards</p>
            </div>
            <select
              value={selectedDashboardSegment}
              onChange={(e) => setSelectedDashboardSegment(e.target.value)}
              className="bg-[var(--dm-bg)] border border-[var(--dm-border)] text-[10px] rounded px-2 py-1 text-[var(--dm-text)] focus:outline-none"
            >
              <option value="curve_42">Gateway Curve (Curve-42)</option>
              <option value="highway_101">Marine Drive (Highway-101)</option>
              <option value="intersection_alpha">Crawford (Intersection-Alpha)</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[140px] overflow-auto mt-2 pr-1">
            {similarSegments.length > 0 ? (
              similarSegments.map((item, index) => (
                <div
                  key={index}
                  className="bg-[var(--dm-bg)]/40 border border-[var(--dm-border)] rounded-lg p-2.5 text-[10px] flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-[var(--dm-text)] uppercase font-mono">{item.similarSegment}</span>
                    <span className="text-[var(--dm-dark-muted)] ml-2">Hazard: {item.sharedHazard?.replace(/_/g, " ")}</span>
                  </div>
                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[8px] font-mono">
                    Logged {item.frequency} times
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[var(--dm-dark-muted)] text-xs border border-dashed border-[var(--dm-border)] rounded-xl">
                No similar segment matches recorded.
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Server Info */}
      {health && (
        <GlassCard className="p-4">
          <h3 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest mb-2">Server Info</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><span className="text-[var(--dm-dark-muted)]">Version:</span> <span className="font-mono text-[var(--dm-text)]">{health.version || "1.0.0"}</span></div>
            <div><span className="text-[var(--dm-dark-muted)]">Uptime:</span> <span className="font-mono text-[var(--dm-text)]">{formatUptime(health.uptime)}</span></div>
            <div><span className="text-[var(--dm-dark-muted)]">Connected Clients:</span> <span className="font-mono text-[var(--dm-text)]">{health.connectedClients ?? "?"}</span></div>
            <div><span className="text-[var(--dm-dark-muted)]">Status:</span> <span className={`font-bold ${health.status === "ok" ? "text-emerald-400" : "text-amber-400"}`}>{health.status?.toUpperCase()}</span></div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function segmentCount() { return ""; }  // Helper used by MetricCard sub — replaced inline

// ── Pipeline Tab ────────────────────────────────────────

function PipelineTab({ steps, lastEvent }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest">Live Pipeline Monitor</h2>
      <p className="text-[11px] text-[var(--dm-dark-muted)]">Each node shows real execution timing from the backend. Amber = degraded service. Red = failed.</p>

      {steps.length > 0 ? (
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {steps.map((step, i) => (
              <React.Fragment key={i}>
                <PipelineNode icon={step.icon} label={step.label} status={step.status} ms={step.ms} />
                {i < steps.length - 1 && (
                  <div className={`w-6 h-px flex-shrink-0 ${step.status === "done" ? "bg-emerald-500/50" : step.status === "degraded" ? "bg-amber-500/50" : "bg-[var(--dm-border)]"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          {lastEvent?.pipelineTiming && (
            <div className="mt-4 pt-4 border-t border-[var(--dm-border)] grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-xs"><span className="text-[var(--dm-dark-muted)]">Total Pipeline:</span> <span className="font-mono font-bold text-indigo-400">{lastEvent.pipelineTiming.totalMs}ms</span></div>
              <div className="text-xs"><span className="text-[var(--dm-dark-muted)]">AI Latency:</span> <span className="font-mono font-bold">{lastEvent.pipelineTiming.aiMs}ms</span></div>
              <div className="text-xs"><span className="text-[var(--dm-dark-muted)]">AI Degraded:</span> <span className={`font-bold ${lastEvent.pipelineTiming.aiDegraded ? "text-amber-400" : "text-emerald-400"}`}>{lastEvent.pipelineTiming.aiDegraded ? "Yes" : "No"}</span></div>
              <div className="text-xs"><span className="text-[var(--dm-dark-muted)]">Neo4j Degraded:</span> <span className={`font-bold ${lastEvent.pipelineTiming.neo4jDegraded ? "text-amber-400" : "text-emerald-400"}`}>{lastEvent.pipelineTiming.neo4jDegraded ? "Yes" : "No"}</span></div>
            </div>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="p-8">
          <EmptyState icon="⚡" title="Waiting for Pipeline Data" message="Send telemetry from a vehicle to see pipeline execution" />
        </GlassCard>
      )}

      {/* Last Event Summary */}
      {lastEvent && (
        <GlassCard glowColor="var(--dm-primary)" className="p-4">
          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">Latest Event</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><span className="text-[var(--dm-dark-muted)]">Vehicle:</span> <span className="font-mono text-[var(--dm-text)]">{lastEvent.vehicleId}</span></div>
            <div><span className="text-[var(--dm-dark-muted)]">Segment:</span> <span className="font-mono text-[var(--dm-text)]">{lastEvent.roadSegmentId}</span></div>
            <div><span className="text-[var(--dm-dark-muted)]">Risk:</span> <span className={`font-bold ${getRiskColor(lastEvent.risk?.riskLevel)}`}>{lastEvent.risk?.riskLevel?.toUpperCase()} ({lastEvent.risk?.riskScore?.toFixed(2)})</span></div>
            <div><span className="text-[var(--dm-dark-muted)]">Intent:</span> <span className="font-mono capitalize text-[var(--dm-text)]">{lastEvent.intentPrediction?.predictedIntent?.replace(/_/g, " ")}</span></div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ── AI Tab ───────────────────────────────────────────────

function AITab({ lastEvent }) {
  const pred = lastEvent?.intentPrediction;
  const telemetry = lastEvent;

  if (!pred) {
    return (
      <GlassCard className="p-8">
        <EmptyState icon="🤖" title="No AI Predictions Yet" message="Send telemetry to see model output" />
      </GlassCard>
    );
  }

  const features = [
    { name: "Speed",     value: telemetry?.speed, max: 120, unit: "km/h" },
    { name: "Accel",     value: telemetry?.acceleration, max: 5, unit: "m/s²", allowNeg: true },
    { name: "Brake",     value: telemetry?.brakePressure, max: 1, unit: "%" },
    { name: "Steering",  value: telemetry?.steeringAngle, max: 45, unit: "°", allowNeg: true },
    { name: "Lane Off",  value: telemetry?.laneOffset, max: 2, unit: "m", allowNeg: true },
    { name: "Front Gap", value: telemetry?.distanceToFrontVehicle, max: 100, unit: "m" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest">AI Explainability</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Prediction */}
        <GlassCard glowColor="var(--dm-primary)" className="p-5">
          <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Model Output</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--dm-muted)]">Predicted Intent</span>
              <span className="text-lg font-black capitalize text-[var(--dm-text)]">{pred.predictedIntent?.replace(/_/g, " ") || "Unknown"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--dm-muted)]">Confidence</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-[var(--dm-bg)] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${(pred.confidence || 0) * 100}%` }} />
                </div>
                <span className="text-sm font-bold text-indigo-400">{((pred.confidence || 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--dm-muted)]">Model</span>
              <span className="text-xs font-mono text-[var(--dm-dark-muted)]">Voting Ensemble (RF + GB + LR)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--dm-muted)]">Inference Time</span>
              <span className="text-sm font-mono text-cyan-400">{pred.latencyMs || lastEvent?.pipelineTiming?.aiMs || "?"}ms</span>
            </div>
            {pred.degraded && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-400 font-semibold">
                ⚠ AI service degraded — fallback prediction used
              </div>
            )}
          </div>
        </GlassCard>

        {/* Feature Inputs */}
        <GlassCard className="p-5">
          <h3 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest mb-4">Input Features</h3>
          <div className="space-y-3">
            {features.map((f) => {
              const raw = f.value ?? 0;
              const pct = Math.min(100, Math.abs(raw) / f.max * 100);
              const isHigh = pct > 70;
              return (
                <div key={f.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--dm-muted)] font-semibold">{f.name}</span>
                    <span className={`font-mono font-bold ${isHigh ? "text-amber-400" : "text-[var(--dm-text)]"}`}>{raw} {f.unit}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--dm-bg)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${isHigh ? "bg-amber-500" : "bg-indigo-500/60"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ── Memory Tab ───────────────────────────────────────────

function MemoryTab({ experiences, selectedSegment, setSelectedSegment }) {
  if (experiences.length === 0) {
    return (
      <GlassCard className="p-8">
        <EmptyState icon="🧠" title="No Experiences Recorded" message="High-risk telemetry events are stored here as collective memory" />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest">Experience Memory ({experiences.length})</h2>
        {selectedSegment && (
          <button onClick={() => setSelectedSegment(null)} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer">✕ Clear Filter</button>
        )}
      </div>
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--dm-border)] bg-[var(--dm-bg)]/50">
                {["Vehicle", "Segment", "Event", "Risk", "Weather", "Action", "Time"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[var(--dm-muted)] font-bold uppercase tracking-widest text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(selectedSegment ? experiences.filter((e) => e.roadSegmentId === selectedSegment) : experiences)
                .slice(0, 50)
                .map((exp, i) => {
                  const riskColor = exp.riskScore >= 0.8 ? "text-red-400" : exp.riskScore >= 0.6 ? "text-orange-400" : "text-amber-400";
                  return (
                    <tr key={exp._id || i} className="border-b border-[var(--dm-border)]/50 hover:bg-[var(--dm-surface-hover)]/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[var(--dm-text)]">{exp.vehicleId}</td>
                      <td className="px-4 py-2.5 capitalize text-cyan-400 cursor-pointer hover:underline" onClick={() => setSelectedSegment(exp.roadSegmentId)}>{exp.roadSegmentId?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 capitalize">{exp.eventType?.replace(/_/g, " ")}</td>
                      <td className={`px-4 py-2.5 font-bold ${riskColor}`}>{exp.riskScore?.toFixed(2)}</td>
                      <td className="px-4 py-2.5 capitalize">{exp.weather}</td>
                      <td className="px-4 py-2.5 capitalize text-[var(--dm-muted)]">{exp.recommendedAction?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 font-mono text-[var(--dm-dark-muted)]">{exp.createdAt ? new Date(exp.createdAt).toLocaleTimeString() : "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ── Graph Tab ────────────────────────────────────────────

function GraphTab({ graphData, selectedNode, setSelectedNode }) {
  if (graphData.length === 0) {
    return (
      <GlassCard className="p-8">
        <EmptyState icon="🕸️" title="No Graph Data" message="Neo4j relationships appear here once experiences are created" />
      </GlassCard>
    );
  }

  const nodeMap = new Map();
  graphData.forEach((rel) => {
    const sKey = `${rel.start.labels[0]}-${JSON.stringify(rel.start.properties)}`;
    const eKey = `${rel.end.labels[0]}-${JSON.stringify(rel.end.properties)}`;
    if (!nodeMap.has(sKey)) nodeMap.set(sKey, { ...rel.start, key: sKey });
    if (!nodeMap.has(eKey)) nodeMap.set(eKey, { ...rel.end, key: eKey });
  });
  const nodes = [...nodeMap.values()];

  const nodeColor = (labels) => {
    const l = labels[0];
    if (l === "Vehicle") return "#4F46E5";
    if (l === "Experience") return "#EF4444";
    if (l === "RoadSegment") return "#06B6D4";
    if (l === "Weather") return "#F59E0B";
    if (l === "Event") return "#F97316";
    if (l === "Action") return "#22C55E";
    return "#64748B";
  };

  // Simple force-free layout in a circle
  const cx = 300, cy = 200, radius = 150;

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest">Neo4j Knowledge Graph ({graphData.length} relationships)</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2 p-4">
          <svg viewBox="0 0 600 400" className="w-full h-auto" style={{ minHeight: "300px" }}>
            <defs>
              <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="var(--dm-dark-muted)" />
              </marker>
            </defs>
            {/* Edges */}
            {graphData.slice(0, 30).map((rel, i) => {
              const sIdx = nodes.findIndex((n) => n.labels[0] === rel.start.labels[0] && JSON.stringify(n.properties) === JSON.stringify(rel.start.properties));
              const eIdx = nodes.findIndex((n) => n.labels[0] === rel.end.labels[0] && JSON.stringify(n.properties) === JSON.stringify(rel.end.properties));
              if (sIdx < 0 || eIdx < 0) return null;
              const sAngle = (sIdx / nodes.length) * 2 * Math.PI;
              const eAngle = (eIdx / nodes.length) * 2 * Math.PI;
              const x1 = cx + radius * Math.cos(sAngle);
              const y1 = cy + radius * Math.sin(sAngle);
              const x2 = cx + radius * Math.cos(eAngle);
              const y2 = cy + radius * Math.sin(eAngle);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--dm-border)" strokeWidth="1" markerEnd="url(#arrowhead)" opacity="0.5" />;
            })}
            {/* Nodes */}
            {nodes.slice(0, 30).map((node, i) => {
              const angle = (i / nodes.length) * 2 * Math.PI;
              const x = cx + radius * Math.cos(angle);
              const y = cy + radius * Math.sin(angle);
              const color = nodeColor(node.labels);
              const isSelected = selectedNode?.key === node.key;
              return (
                <g key={node.key} onClick={() => setSelectedNode(isSelected ? null : node)} className="cursor-pointer">
                  <circle cx={x} cy={y} r={isSelected ? 12 : 8} fill={color} opacity={isSelected ? 1 : 0.7} stroke={isSelected ? "#fff" : "none"} strokeWidth="2" />
                  <text x={x} y={y - 14} textAnchor="middle" fill="var(--dm-muted)" fontSize="8" fontWeight="bold">{node.labels[0]}</text>
                </g>
              );
            })}
          </svg>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--dm-border)]">
            {[["Vehicle", "#4F46E5"], ["Experience", "#EF4444"], ["RoadSegment", "#06B6D4"], ["Weather", "#F59E0B"], ["Event", "#F97316"], ["Action", "#22C55E"]].map(([l, c]) => (
              <div key={l} className="flex items-center gap-1.5 text-[10px] text-[var(--dm-muted)]">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                {l}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Node Inspector */}
        <GlassCard className="p-4">
          <h3 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest mb-3">Node Inspector</h3>
          {selectedNode ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeColor(selectedNode.labels) }} />
                <span className="text-sm font-bold">{selectedNode.labels.join(", ")}</span>
              </div>
              {Object.entries(selectedNode.properties || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs border-b border-[var(--dm-border)]/30 pb-1.5">
                  <span className="text-[var(--dm-dark-muted)] capitalize">{k}</span>
                  <span className="font-mono text-[var(--dm-text)] truncate max-w-[160px]">{String(v)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="👆" title="Select a Node" message="Click any node in the graph to inspect its properties" />
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ── Map Tab ──────────────────────────────────────────────

function MapTab({ experiences, lastEvent, setSelectedSegment, setActiveTab }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest">Road Risk Heatmap — Chandigarh</h2>
      <GlassCard className="p-0 overflow-hidden" style={{ minHeight: "450px" }}>
        <RiskMap
          experiences={experiences}
          latestAlert={lastEvent}
          onSelectSegment={(segId) => {
            setSelectedSegment(segId);
            setActiveTab("memory");
          }}
        />
      </GlassCard>
    </div>
  );
}

// ── Logs Tab ─────────────────────────────────────────────

function LogsTab({ logs, socketEvents, logsEndRef }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* System Logs */}
      <GlassCard className="p-4 flex flex-col" style={{ maxHeight: "600px" }}>
        <h3 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest mb-3 flex-shrink-0">System Log ({logs.length})</h3>
        <div className="flex-1 overflow-auto space-y-1.5 font-mono pr-1">
          {logs.length > 0 ? logs.map((l, i) => (
            <LogEntry key={i} time={l.time} category={l.category} message={l.message} status={l.status} />
          )) : (
            <EmptyState icon="📟" title="No Logs Yet" message="Logs appear as events flow through the pipeline" />
          )}
          <div ref={logsEndRef} />
        </div>
      </GlassCard>

      {/* Socket Broadcast Monitor */}
      <GlassCard className="p-4 flex flex-col" style={{ maxHeight: "600px" }}>
        <h3 className="text-xs font-bold text-[var(--dm-muted)] uppercase tracking-widest mb-3 flex-shrink-0">Socket.IO Broadcast Monitor ({socketEvents.length})</h3>
        <div className="flex-1 overflow-auto pr-1">
          {socketEvents.length > 0 ? (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-[var(--dm-border)]">
                  {["Vehicle", "Segment", "Risk", "Intent", "Exp?"].map((h) => (
                    <th key={h} className="text-left px-2 py-1.5 text-[var(--dm-dark-muted)] font-bold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {socketEvents.map((ev, i) => (
                  <tr key={i} className="border-b border-[var(--dm-border)]/30">
                    <td className="px-2 py-1.5 font-mono text-[var(--dm-text)]">{ev.vehicleId}</td>
                    <td className="px-2 py-1.5 capitalize">{ev.roadSegmentId?.replace(/_/g, " ")}</td>
                    <td className={`px-2 py-1.5 font-bold ${getRiskColor(ev.risk?.riskLevel)}`}>{ev.risk?.riskLevel}</td>
                    <td className="px-2 py-1.5 capitalize">{ev.intentPrediction?.predictedIntent?.replace(/_/g, " ")}</td>
                    <td className="px-2 py-1.5">{ev.experienceCreated ? "✅" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon="📡" title="No Broadcasts" message="Socket events appear here in real-time" />
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// ── Utility ──────────────────────────────────────────────

function getRiskColor(level) {
  switch (level) {
    case "critical": return "text-red-400";
    case "high":     return "text-orange-400";
    case "medium":   return "text-amber-400";
    default:         return "text-emerald-400";
  }
}

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export default AdminDashboard;
