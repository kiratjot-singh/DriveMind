const { getNeo4jDriver } = require("../config/neo4j");

const getGraphOverview = async (req, res) => {
  const driver = getNeo4jDriver();

  if (!driver) {
    return res.status(503).json({
      success: false,
      message: "Neo4j driver not available"
    });
  }

  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (n)-[r]->(m)
      RETURN n, r, m
      LIMIT 50
      `
    );

    const relationships = result.records.map((record) => {
      const startNode = record.get("n");
      const relationship = record.get("r");
      const endNode = record.get("m");

      return {
        start: {
          labels: startNode.labels,
          properties: startNode.properties
        },
        relationship: {
          type: relationship.type,
          properties: relationship.properties
        },
        end: {
          labels: endNode.labels,
          properties: endNode.properties
        }
      };
    });

    res.json({
      success: true,
      count: relationships.length,
      data: relationships
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch graph overview",
      error: error.message
    });
  } finally {
    await session.close();
  }
};

const getRiskClusters = async (req, res) => {
  const driver = getNeo4jDriver();

  if (!driver) {
    return res.status(503).json({
      success: false,
      message: "Neo4j driver not available"
    });
  }

  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (r1:RoadSegment)<-[:AT]-(e1:Experience)-[:TYPE]->(ev:Event)<-[:TYPE]-(e2:Experience)-[:AT]->(r2:RoadSegment)
      WHERE r1.roadSegmentId < r2.roadSegmentId
      RETURN r1.roadSegmentId AS segmentA, r2.roadSegmentId AS segmentB, ev.type AS sharedRiskType, COUNT(ev) AS strength
      ORDER BY strength DESC
      LIMIT 10
      `
    );

    const clusters = result.records.map((record) => ({
      segmentA: record.get("segmentA"),
      segmentB: record.get("segmentB"),
      sharedRiskType: record.get("sharedRiskType"),
      strength: record.get("strength").toNumber ? record.get("strength").toNumber() : record.get("strength")
    }));

    res.json({
      success: true,
      count: clusters.length,
      data: clusters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch risk clusters",
      error: error.message
    });
  } finally {
    await session.close();
  }
};

const getSimilarSegments = async (req, res) => {
  const { roadSegmentId } = req.params;
  const driver = getNeo4jDriver();

  if (!driver) {
    return res.status(503).json({
      success: false,
      message: "Neo4j driver not available"
    });
  }

  const session = driver.session();

  try {
    const result = await session.run(
      `
      MATCH (r:RoadSegment {roadSegmentId: $roadSegmentId})<-[:AT]-(e:Experience)-[:TYPE]->(ev:Event)
      MATCH (other:RoadSegment)<-[:AT]-(otherExp:Experience)-[:TYPE]->(ev)
      WHERE other.roadSegmentId <> r.roadSegmentId
      RETURN other.roadSegmentId AS similarSegment, ev.type AS sharedHazard, COUNT(otherExp) AS frequency
      ORDER BY frequency DESC
      LIMIT 5
      `,
      { roadSegmentId }
    );

    const similarities = result.records.map((record) => ({
      similarSegment: record.get("similarSegment"),
      sharedHazard: record.get("sharedHazard"),
      frequency: record.get("frequency").toNumber ? record.get("frequency").toNumber() : record.get("frequency")
    }));

    res.json({
      success: true,
      roadSegmentId,
      count: similarities.length,
      data: similarities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to find similar segments",
      error: error.message
    });
  } finally {
    await session.close();
  }
};

module.exports = {
  getGraphOverview,
  getRiskClusters,
  getSimilarSegments
};