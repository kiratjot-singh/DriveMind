const calculateRiskFromTelemetry = (telemetry) => {
  let riskScore = 0;
  const reasons = [];
  const events = [];
  const recommendations = [];

  if (telemetry.speed > 60) {
    riskScore += 0.2;
    reasons.push(`Vehicle speed (${telemetry.speed} km/h) exceeds safe speed limit threshold (60 km/h)`);
    events.push("high_speed_risk");
    recommendations.push("Reduce speed immediately to align with segment speed limits.");
  }

  if (telemetry.brakePressure > 0.7 && telemetry.acceleration < -1) {
    riskScore += 0.25;
    reasons.push("Sudden heavy deceleration and high brake pressure detected");
    events.push("sudden_braking");
    recommendations.push("Avoid abrupt braking maneuvers by maintaining greater forward awareness.");
  }

  if (Math.abs(telemetry.steeringAngle) > 15 && telemetry.speed > 45) {
    riskScore += 0.2;
    reasons.push(`Sharp steering turn (${Math.abs(telemetry.steeringAngle)}°) executed while traveling at high speed (${telemetry.speed} km/h)`);
    events.push("sharp_turn_risk");
    recommendations.push("Reduce speed prior to entering turning curves to prevent lateral traction loss.");
  }

  if (telemetry.distanceToFrontVehicle < 10 && telemetry.speed > 40) {
    riskScore += 0.25;
    reasons.push(`Unsafe following distance gap (${telemetry.distanceToFrontVehicle}m) at current speed (${telemetry.speed} km/h)`);
    events.push("near_miss");
    recommendations.push("Increase following distance immediately. Maintain at least a 3-second safety gap.");
  }

  if (telemetry.weather === "rain" || telemetry.weather === "fog") {
    riskScore += 0.1;
    reasons.push(`Adverse climate conditions: ${telemetry.weather}`);

    if (telemetry.weather === "fog") {
      events.push("low_visibility");
      recommendations.push("Turn on fog lights and reduce speeds to account for degraded visual range.");
    } else {
      recommendations.push("Increase safety spacing to compensate for reduced wet pavement traction.");
    }
  }

  riskScore = Number(Math.min(riskScore, 1).toFixed(2));

  let riskLevel = "low";

  if (riskScore > 0.8) {
    riskLevel = "critical";
  } else if (riskScore > 0.6) {
    riskLevel = "high";
  } else if (riskScore > 0.3) {
    riskLevel = "medium";
  }

  const recommendedAction =
    riskLevel === "critical"
      ? "reduce_speed_immediately_and_increase_following_distance"
      : riskLevel === "high"
      ? "reduce_speed_by_25_percent"
      : riskLevel === "medium"
      ? "drive_with_caution"
      : "continue_normal_driving";

  // Provide fallback recommendations if list is empty
  if (recommendations.length === 0) {
    recommendations.push("Continue normal driving. Maintain standard speed limit and awareness.");
  }

  return {
    riskScore,
    riskLevel,
    reasons,
    events: [...new Set(events)],
    recommendedAction,
    recommendations,
    confidence: Number((0.7 + riskScore * 0.25).toFixed(2))
  };
};

module.exports = {
  calculateRiskFromTelemetry
};