import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loginUser, registerUser } from "../api/backendApi";

function AdminLogin({ onAuthSuccess, onBackToSelector }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = isRegister ? registerUser : loginUser;
      const data = await fn(username, password);
      if (data.success) {
        localStorage.setItem("drivemind_admin_token", data.token);
        localStorage.setItem("drivemind_admin_user", JSON.stringify(data.user));
        onAuthSuccess(data.token, data.user);
      } else {
        setError(data.message || (isRegister ? "Registration failed" : "Invalid credentials"));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Authentication request failed");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister((v) => !v);
    setError("");
    setUsername("");
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-[var(--dm-bg)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/[0.06] blur-[120px] pointer-events-none" />

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
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent rounded-t-3xl" />

          <div className="mb-7">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center">
                <span className="text-base">🔒</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">
                DriveMind — Secure Access
              </span>
            </div>
            <h2 className="text-2xl font-black text-[var(--dm-text)] leading-tight">
              {isRegister ? "Create Admin Account" : "Admin Login"}
            </h2>
            <p className="text-[var(--dm-muted)] text-sm mt-1.5 leading-relaxed">
              {isRegister
                ? "Register to join the DriveMind operations team."
                : "Sign in to access monitoring, analytics, and system diagnostics."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--dm-muted)] uppercase tracking-widest mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin_01"
                className="w-full bg-[var(--dm-bg)] border border-[var(--dm-border)] focus:border-indigo-500/70 rounded-xl px-4 py-3 text-sm text-[var(--dm-text)] placeholder-[var(--dm-dark-muted)] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--dm-muted)] uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full bg-[var(--dm-bg)] border border-[var(--dm-border)] focus:border-indigo-500/70 rounded-xl px-4 py-3 text-sm text-[var(--dm-text)] placeholder-[var(--dm-dark-muted)] outline-none transition-colors"
              />
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : isRegister ? (
                "Create Account →"
              ) : (
                "Access Operations Center →"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--dm-border)] text-center">
            <button
              onClick={switchMode}
              className="text-sm text-[var(--dm-muted)] hover:text-indigo-400 transition-colors cursor-pointer font-medium"
            >
              {isRegister
                ? "Already have an account? Sign In"
                : "Need an account? Register here"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default AdminLogin;
