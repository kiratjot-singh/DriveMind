const express = require("express");
const mongoose = require("mongoose");
const { getNeo4jDriver } = require("../config/neo4j");

const router = express.Router();

router.get("/", async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? "healthy" : "unhealthy";
  
  let neo4jStatus = "unhealthy";
  const driver = getNeo4jDriver();
  
  if (driver) {
    try {
      const session = driver.session();
      await session.run("RETURN 1");
      await session.close();
      neo4jStatus = "healthy";
    } catch (err) {
      neo4jStatus = `unhealthy: ${err.message}`;
    }
  } else {
    neo4jStatus = "uninitialized";
  }

  const isHealthy = mongoStatus === "healthy" && neo4jStatus === "healthy";

  res.status(isHealthy ? 200 : 500).json({
    status: isHealthy ? "ok" : "degraded",
    service: "DriveMind Backend",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    databases: {
      mongodb: mongoStatus,
      neo4j: neo4jStatus
    }
  });
});

module.exports = router;