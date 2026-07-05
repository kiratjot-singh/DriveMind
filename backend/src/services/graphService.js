const { getNeo4jDriver } = require("../config/neo4j");
const { createModuleLogger } = require("../config/logger");

const log = createModuleLogger("graphService");

/**
 * Retry a Neo4j operation up to `maxRetries` times.
 */
const withRetry = async (fn, maxRetries = 2) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      log.warn(
        { attempt, maxRetries, error: err.message },
        `Neo4j operation failed, attempt ${attempt}/${maxRetries}`
      );
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 300));
      }
    }
  }
  throw lastError;
};

const createExperienceGraph = async ({
  vehicleId,
  roadSegmentId,
  weather,
  eventType,
  reason,
  riskScore,
  recommendedAction,
  latitude,
  longitude,
}) => {
  const driver = getNeo4jDriver();
  const start = Date.now();

  if (!driver) {
    log.warn("Neo4j driver not available — graph memory skipped");
    return { success: false, degraded: true, latencyMs: 0 };
  }

  const session = driver.session({ database: "neo4j" });

  try {
    const result = await withRetry(async () => {
      return session.run(
        `
        MERGE (v:Vehicle {vehicleId: $vehicleId})
        MERGE (r:RoadSegment {roadSegmentId: $roadSegmentId})
        SET r.latitude = $latitude, r.longitude = $longitude
        MERGE (w:Weather {type: $weather})
        MERGE (e:Event {type: $eventType})
        MERGE (a:Action {name: $recommendedAction})
        CREATE (exp:Experience {
          reason: $reason,
          riskScore: $riskScore,
          latitude: $latitude,
          longitude: $longitude,
          createdAt: datetime()
        })
        MERGE (v)-[:EXPERIENCED]->(exp)
        MERGE (exp)-[:AT]->(r)
        MERGE (exp)-[:DURING]->(w)
        MERGE (exp)-[:TYPE]->(e)
        MERGE (exp)-[:SUGGESTS]->(a)
        RETURN exp
        `,
        {
          vehicleId,
          roadSegmentId,
          weather,
          eventType,
          reason,
          riskScore,
          recommendedAction,
          latitude,
          longitude,
        }
      );
    });

    const latencyMs = Date.now() - start;
    log.info(
      { vehicleId, roadSegmentId, latencyMs },
      "Experience graph created"
    );

    return {
      success: true,
      degraded: false,
      record: result.records[0]?.get("exp") || null,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    log.error(
      { error: error.message, vehicleId, roadSegmentId, latencyMs },
      "Failed to create Neo4j experience graph after retries"
    );
    return { success: false, degraded: true, latencyMs };
  } finally {
    await session.close();
  }
};

module.exports = {
  createExperienceGraph,
};