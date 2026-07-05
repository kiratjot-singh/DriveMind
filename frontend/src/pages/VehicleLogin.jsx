import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { registerVehicle } from "../api/backendApi";

const VEHICLE_TYPES = [
  { value: "car",       label: "🚗  Car — Passenger Vehicle" },
  { value: "truck",     label: "🚛  Truck — Commercial Cargo" },
  { value: "bus",       label: "🚌  Bus — Transit Transport" },
  { value: "bike",      label: "🏍️  Bike — Two-Wheeler" },
  { value: "emergency", label: "🚑  Emergency Response" },
];

function VehicleLogin({ onAuthSuccess, onBackToSelector }) {
  const [vehicleId,   setVehicleId]   = useState("");
  const [vehicleType, setVehicleType] = useState("car");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await registerVehicle(vehicleId, vehicleType);
      if (data.success) {
        localStorage.setItem("active_vehicle_token", data.token);
        localStorage.setItem("active_vehicle_id", vehicleId);
        onAuthSuccess(data.token, { vehicleId, vehicleType });
      } else {
        setError(data.message || "Vehicle registration failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to register vehicle identity");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--dm-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.06] blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <button
          onClick={onBackToSelector}
          className="inline-flex items-center gap-2 text-[var(--dm-muted)] hover:text-[var(--dm-text)] text-sm font-medium mb-8 transition-colors cursor-pointer group"
        >
          <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
          Back to portal selection
        </button>

        <div className="relative bg-[var(--dm-surface)]/80 backdrop-blur-xl border border-[var(--dm-border)] rounded-3xl p-8 shadow-2xl">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent rounded-t-3xl" />

          <div className="mb-7">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
                <span className="text-base">🚗</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
                Connected Vehicle Terminal
              </span>
            </div>
            <h2 className="text-2xl font-black text-[var(--dm-text)] leading-tight">
              Vehicle Registration
            </h2>
            <p className="text-[var(--dm-muted)] text-sm mt-1.5 leading-relaxed">
              Register your vehicle ID to activate V2X safety channels.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--dm-muted)] uppercase tracking-widest mb-1.5">
                Vehicle ID / License Plate
              </label>
              <input
                type="text"
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                placeholder="e.g. PB-10-TATA-8900"
                className="w-full bg-[var(--dm-bg)] border border-[var(--dm-border)] focus:border-cyan-500/70 rounded-xl px-4 py-3 text-sm text-[var(--dm-text)] placeholder-[var(--dm-dark-muted)] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--dm-muted)] uppercase tracking-widest mb-1.5">
                Vehicle Class
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full bg-[var(--dm-bg)] border border-[var(--dm-border)] focus:border-cyan-500/70 rounded-xl px-4 py-3 text-sm text-[var(--dm-text)] outline-none transition-colors cursor-pointer"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm"
                >
                  <span className="mt-0.5">⚠</span>
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Provisioning Vehicle…</span>
                </>
              ) : (
                "Activate Vehicle Cockpit →"
              )}
            </button>
          </form>

          <p className="text-[var(--dm-dark-muted)] text-[11px] text-center mt-5 leading-relaxed">
            Each vehicle receives a unique session token for telemetry streaming and V2V alerts.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default VehicleLogin;
