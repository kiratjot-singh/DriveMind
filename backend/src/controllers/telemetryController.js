const Vehicle = require("../models/Vehicle");
const Telemetry = require("../models/Telemetry");
const Experience = require("../models/Experience");
const { calculateRiskFromTelemetry } = require("../services/riskService");
const { predictIntent } = require("../services/aiService");
const { emitRiskAlert } = require("../services/socketService");
const { createExperienceGraph } = require("../services/graphService");

const createTelemetry = async (req, res) => {
  try {
    const {
      vehicleId,
      roadSegmentId,
      speed,
      acceleration,
      brakePressure,
      steeringAngle,
      laneOffset,
      distanceToFrontVehicle,
      weather
    } = req.body;

    if (!vehicleId || !roadSegmentId) {
      return res.status(400).json({
        success: false,
        message: "vehicleId and roadSegmentId are required"
      });
    }

    const telemetry = await Telemetry.create({
      vehicleId,
      roadSegmentId,
      speed,
      acceleration,
      brakePressure,
      steeringAngle,
      laneOffset,
      distanceToFrontVehicle,
      weather
    });

    await Vehicle.findOneAndUpdate(
      { vehicleId },
      {
        vehicleId,
        lastKnownRoadSegment: roadSegmentId,
        lastTelemetryAt: new Date(),
        status: "active"
      },
      { upsert: true, new: true }
    );

    const intentPrediction = await predictIntent({
      vehicleId,
      speed,
      acceleration,
      brakePressure,
      steeringAngle,
      laneOffset,
      distanceToFrontVehicle
    });

    const riskResult = calculateRiskFromTelemetry({
      speed,
      acceleration,
      brakePressure,
      steeringAngle,
      laneOffset,
      distanceToFrontVehicle,
      weather
    });

    // Query past incidents from MongoDB for historical context
    const pastIncidentsCount = await Experience.countDocuments({ roadSegmentId });
    riskResult.pastIncidentsCount = pastIncidentsCount;

    let savedExperience = null;
    let graphMemoryCreated = false;

    if (riskResult.riskScore >= 0.6 && riskResult.events.length > 0) {
      savedExperience = await Experience.create({
        vehicleId,
        roadSegmentId,
        weather,
        eventType: riskResult.events[0],
        reason: riskResult.reasons.join(", "),
        riskScore: riskResult.riskScore,
        confidence: riskResult.confidence,
        recommendedAction: riskResult.recommendedAction
      });

      await createExperienceGraph({
        vehicleId,
        roadSegmentId,
        weather,
        eventType: riskResult.events[0],
        reason: riskResult.reasons.join(", "),
        riskScore: riskResult.riskScore,
        recommendedAction: riskResult.recommendedAction
      });

      graphMemoryCreated = true;

      emitRiskAlert({
        type: "risk-alert",
        vehicleId,
        roadSegmentId,
        weather,
        riskLevel: riskResult.riskLevel,
        riskScore: riskResult.riskScore,
        predictedIntent: intentPrediction.predictedIntent,
        intentConfidence: intentPrediction.confidence,
        reasons: riskResult.reasons,
        recommendedAction: riskResult.recommendedAction,
        recommendations: riskResult.recommendations,
        pastIncidentsCount,
        message: `High risk detected at ${roadSegmentId}. Recommended action: ${riskResult.recommendedAction}`
      });
    }

    res.status(201).json({
      success: true,
      message: "Telemetry stored successfully",
      data: {
        telemetry,
        intentPrediction,
        risk: riskResult,
        experienceCreated: savedExperience ? true : false,
        graphMemoryCreated,
        experience: savedExperience
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to store telemetry",
      error: error.message
    });
  }
};

module.exports = {
  createTelemetry
};