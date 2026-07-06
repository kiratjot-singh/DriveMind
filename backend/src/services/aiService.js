const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const logger = require("../config/logger");

const log = logger.createModuleLogger("aiService");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// Create a dedicated axios instance for the AI service
const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 2000,
});

// Configure retry: 3 attempts with exponential backoff (200ms, 400ms, 800ms)
axiosRetry(aiClient, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 200,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.code === "ECONNABORTED",
  onRetry: (retryCount, error) => {
    log.warn(
      `AI service retry attempt ${retryCount}: ${error.message}`
    );
  },
});

const predictIntent = async (telemetry) => {
  const start = Date.now();
  try {
    const response = await aiClient.post("/predict-intent", {
      speed: telemetry.speed,
      acceleration: telemetry.acceleration,
      brakePressure: telemetry.brakePressure,
      steeringAngle: telemetry.steeringAngle,
      laneOffset: telemetry.laneOffset,
      distanceToFrontVehicle: telemetry.distanceToFrontVehicle,
      vehicleId: telemetry.vehicleId,
    });

    const latencyMs = Date.now() - start;
    log.info(
      `AI prediction completed: intent=${response.data.predictedIntent}, confidence=${response.data.confidence} (${latencyMs}ms)`
    );

    return {
      ...response.data,
      latencyMs,
      degraded: false,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    log.error(
      `AI service unavailable after retries: ${error.message} (${latencyMs}ms)`
    );

    return {
      success: false,
      predictedIntent: "unknown",
      confidence: 0,
      message: "AI service unavailable — prediction degraded",
      degraded: true,
      latencyMs,
    };
  }
};

module.exports = {
  predictIntent,
};