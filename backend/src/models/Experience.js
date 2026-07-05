const mongoose = require("mongoose");

const experienceSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: String,
      required: true,
      index: true
    },

    roadSegmentId: {
      type: String,
      required: true,
      index: true
    },

    weather: {
      type: String,
      enum: ["clear", "rain", "fog", "snow", "storm", "unknown"],
      default: "unknown"
    },

    eventType: {
      type: String,
      enum: [
        "near_miss",
        "sudden_braking",
        "low_visibility",
        "sharp_turn_risk",
        "lane_change_risk",
        "high_speed_risk"
      ],
      required: true
    },

    reason: {
      type: String,
      required: true
    },

    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },

    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },

    recommendedAction: {
      type: String,
      required: true
    },

    latitude: {
      type: Number,
      required: false
    },

    longitude: {
      type: Number,
      required: false
    },

    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Experience", experienceSchema);