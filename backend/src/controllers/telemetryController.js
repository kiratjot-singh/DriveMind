const Vehicle = require("../models/Vehicle");
const Telemetry = require("../models/Telemetry");
const Experience = require("../models/Experience");
const { calculateRiskFromTelemetry } = require("../services/riskService");
const { predictIntent } = require("../services/aiService");
const { emitRiskAlert, emitTelemetryProcessed } = require("../services/socketService");
const { createExperienceGraph } = require("../services/graphService");
const { CHANDIGARH_COORDINATES } = require("../config/roadSegments");
const { createModuleLogger } = require("../config/logger");

const log = createModuleLogger("telemetryController");

/**
 * Measure execution time of an async function.
 * Returns { result, ms }.
 */
const timed = async (fn) => {
  const start = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - start };
};

const createTelemetry = async (req, res) => {
  const pipelineStart = Date.now();

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
      weather,
    } = req.body;

    // Pipeline timing accumulator
    const pipelineTiming = {
      mongoWriteMs: 0,
      aiMs: 0,
      riskMs: 0,
      mongoExpMs: 0,
      neo4jMs: 0,
      socketMs: 0,
      totalMs: 0,
      aiRetries: 0,
      neo4jRetries: 0,
      aiDegraded: false,
      neo4jDegraded: false,
    };

    // Stage 1: Save raw telemetry to MongoDB
    const { result: telemetry, ms: mongoWriteMs } = await timed(() =>
      Telemetry.create({
        vehicleId,
        roadSegmentId,
        speed,
        acceleration,
        brakePressure,
        steeringAngle,
        laneOffset,
        distanceToFrontVehicle,
        weather,
      })
    );
    pipelineTiming.mongoWriteMs = mongoWriteMs;

    // Update vehicle record (fire-and-forget)
    Vehicle.findOneAndUpdate(
      { vehicleId },
      {
        vehicleId,
        lastKnownRoadSegment: roadSegmentId,
        lastTelemetryAt: new Date(),
        status: "active",
      },
      { upsert: true, new: true }
    ).catch((err) => log.warn({ err: err.message }, "Vehicle update failed"));

    // Stage 2: AI Intent Prediction
    const { result: intentPrediction, ms: aiMs } = await timed(() =>
      predictIntent({
        speed,
        acceleration,
        brakePressure,
        steeringAngle,
        laneOffset,
        distanceToFrontVehicle,
      })
    );
    pipelineTiming.aiMs = aiMs;
    pipelineTiming.aiDegraded = intentPrediction.degraded || false;

    // Stage 3: Risk Scoring
    const riskStart = Date.now();
    const riskResult = calculateRiskFromTelemetry({
      speed,
      acceleration,
      brakePressure,
      steeringAngle,
      laneOffset,
      distanceToFrontVehicle,
      weather,
    });
    pipelineTiming.riskMs = Date.now() - riskStart;

    // Stage 4: Collective Memory Lookup
    const similarPastExperiences = await Experience.find({
      roadSegmentId,
      $or: [
        { weather },
        { eventType: riskResult.events[0] || "near_miss" },
      ],
    })
      .sort({ riskScore: -1 })
      .limit(5);

    let collectiveRecommendation = null;
    if (similarPastExperiences.length > 0) {
      collectiveRecommendation = {
        action: similarPastExperiences[0].recommendedAction,
        reason: similarPastExperiences[0].reason,
        resolvedCount: similarPastExperiences.length,
        averageRiskScore: Number(
          (
            similarPastExperiences.reduce((sum, exp) => sum + exp.riskScore, 0) /
            similarPastExperiences.length
          ).toFixed(2)
        ),
      };
    }

    // Stage 5 & 6: Experience Creation (MongoDB + Neo4j)
    let savedExperience = null;
    let graphMemoryResult = { success: false, degraded: false };

    if (riskResult.riskScore >= 0.6 && riskResult.events.length > 0) {
      const coords = CHANDIGARH_COORDINATES[roadSegmentId] || {
        latitude: 30.7333,
        longitude: 76.7794,
      };

      // MongoDB Experience write
      const { result: exp, ms: mongoExpMs } = await timed(() =>
        Experience.create({
          vehicleId,
          roadSegmentId,
          weather,
          eventType: riskResult.events[0],
          reason: riskResult.reasons.join(", "),
          riskScore: riskResult.riskScore,
          confidence: riskResult.confidence,
          recommendedAction: riskResult.recommendedAction,
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
      );
      savedExperience = exp;
      pipelineTiming.mongoExpMs = mongoExpMs;

      // Neo4j Graph write
      const { result: graphResult, ms: neo4jMs } = await timed(() =>
        createExperienceGraph({
          vehicleId,
          roadSegmentId,
          weather,
          eventType: riskResult.events[0],
          reason: riskResult.reasons.join(", "),
          riskScore: riskResult.riskScore,
          recommendedAction: riskResult.recommendedAction,
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
      );
      graphMemoryResult = graphResult;
      pipelineTiming.neo4jMs = neo4jMs;
      pipelineTiming.neo4jDegraded = graphResult.degraded || false;

      // Stage 7: Socket.IO broadcast
      const socketStart = Date.now();
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
        message: `High risk detected at ${roadSegmentId}. Recommended action: ${riskResult.recommendedAction}`,
        collectiveRecommendation,
        similarPastExperiences,
      });
      pipelineTiming.socketMs = Date.now() - socketStart;
    }

    pipelineTiming.totalMs = Date.now() - pipelineStart;

    // Stage 8: Emit full processed event to all dashboards
    emitTelemetryProcessed({
      vehicleId,
      roadSegmentId,
      weather,
      speed,
      acceleration,
      brakePressure,
      steeringAngle,
      laneOffset,
      distanceToFrontVehicle,
      telemetry,
      intentPrediction,
      risk: riskResult,
      experienceCreated: !!savedExperience,
      graphMemoryCreated: graphMemoryResult.success || false,
      experience: savedExperience,
      collectiveRecommendation,
      similarPastExperiences,
      pipelineTiming,
      timestamp: new Date(),
    });

    log.info(
      {
        vehicleId,
        roadSegmentId,
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        pipelineTiming,
      },
      "Telemetry pipeline completed"
    );

    res.status(201).json({
      success: true,
      message: "Telemetry stored successfully",
      data: {
        telemetry,
        intentPrediction,
        risk: riskResult,
        experienceCreated: !!savedExperience,
        graphMemoryCreated: graphMemoryResult.success || false,
        experience: savedExperience,
        collectiveRecommendation,
        similarPastExperiences,
        pipelineTiming,
      },
    });
  } catch (error) {
    log.error(
      { err: error.message, stack: error.stack },
      "Telemetry pipeline failed"
    );
    res.status(500).json({
      success: false,
      message: "Failed to store telemetry",
      error: error.message,
    });
  }
};

module.exports = {
  createTelemetry,
};