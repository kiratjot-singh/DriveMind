const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

const predictIntent = async (telemetry) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/predict-intent`, {
      speed: telemetry.speed,
      acceleration: telemetry.acceleration,
      brakePressure: telemetry.brakePressure,
      steeringAngle: telemetry.steeringAngle,
      laneOffset: telemetry.laneOffset,
      distanceToFrontVehicle: telemetry.distanceToFrontVehicle,
      vehicleId: telemetry.vehicleId
    });

    return response.data;
  } catch (error) {
    return {
      success: false,
      predictedIntent: "unknown",
      confidence: 0,
      message: "AI service unavailable"
    };
  }
};

module.exports = {
  predictIntent
};