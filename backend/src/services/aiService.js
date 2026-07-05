const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const { createModuleLogger } = require("../config/logger");

const log = createModuleLogger("aiService");

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
      { retryCount, error: error.message },
      `AI service retry attempt ${retryCount}`
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
    });

    const latencyMs = Date.now() - start;
    log.info(
      { intent: response.data.predictedIntent, confidence: response.data.confidence, latencyMs },
      "AI prediction completed"
    );

    return {
      ...response.data,
      latencyMs,
      degraded: false,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    log.error(
      { error: error.message, latencyMs },
      "AI service unavailable after retries"
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