import axios from "axios";

const API_BASE_URL = "http://localhost:5001";

// Create configured axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Automatically inject JWT token into requests
apiClient.interceptors.request.use(
  (config) => {
    // Try admin token first, then fall back to vehicle token
    const adminToken = localStorage.getItem("drivemind_admin_token");
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — auto-logout on 401/403
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Don't auto-logout on auth endpoints
      const url = error.config?.url || "";
      if (!url.includes("/api/auth")) {
        console.warn("[DriveMind] Session expired or unauthorized — clearing tokens");
        localStorage.removeItem("drivemind_admin_token");
        localStorage.removeItem("drivemind_admin_user");
      }
    }
    return Promise.reject(error);
  }
);

// ── Admin Authentication ───────────────────────────────

export const loginUser = async (username, password) => {
  const response = await apiClient.post("/api/auth/login", { username, password });
  return response.data;
};

export const registerUser = async (username, password) => {
  const response = await apiClient.post("/api/auth/register", { username, password });
  return response.data;
};

// ── Vehicle Authentication ─────────────────────────────

export const registerVehicle = async (vehicleId, vehicleType) => {
  const response = await apiClient.post("/api/auth/vehicle", { vehicleId, vehicleType });
  return response.data;
};

// ── Data APIs ──────────────────────────────────────────

export const getHealthStatus = async () => {
  const response = await apiClient.get("/api/health");
  return response.data;
};

export const getAllExperiences = async () => {
  const response = await apiClient.get("/api/experiences");
  return response.data;
};

export const getRoadRisk = async (roadSegmentId) => {
  const response = await apiClient.get(`/api/road-risk/${roadSegmentId}`);
  return response.data;
};

export const getGraphOverview = async () => {
  const response = await apiClient.get("/api/graph");
  return response.data;
};

export const getRiskClusters = async () => {
  const response = await apiClient.get("/api/graph/clusters");
  return response.data;
};

export const sendTelemetry = async (telemetryData) => {
  const activeToken = localStorage.getItem("active_vehicle_token") || "vehicle_secret_token_123";
  const response = await apiClient.post("/api/telemetry", telemetryData, {
    headers: {
      "X-Vehicle-Token": activeToken,
    },
  });
  return response.data;
};

export { apiClient };