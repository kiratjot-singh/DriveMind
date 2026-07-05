import axios from "axios";

const API_BASE_URL = "http://localhost:5001";

// Create configured axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL
});

// Automatically inject JWT token into requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("drivemind_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Admin Authentication callers
export const loginUser = async (username, password) => {
  const response = await apiClient.post("/api/auth/login", { username, password });
  return response.data;
};

export const registerUser = async (username, password) => {
  const response = await apiClient.post("/api/auth/register", { username, password });
  return response.data;
};

// Vehicle Authentication callers
export const registerVehicle = async (vehicleId, vehicleType) => {
  const response = await apiClient.post("/api/auth/vehicle", { vehicleId, vehicleType });
  return response.data;
};

// Telemetry & Experience API callers
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
      "X-Vehicle-Token": activeToken
    }
  });
  return response.data;
};

export const getExperienceStats = async () => {
  const response = await apiClient.get("/api/experiences/stats");
  return response.data;
};

export const getSimilarSegments = async (roadSegmentId) => {
  const response = await apiClient.get(`/api/graph/similar/${roadSegmentId}`);
  return response.data;
};