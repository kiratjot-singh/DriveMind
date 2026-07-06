const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const { getNeo4jDriver } = require("../config/neo4j");
const { getConnectedClients } = require("../services/socketService");

const router = express.Router();
const startedAt = new Date();

router.get("/", async (req, res) => {
  const healthStatus = {
    status: "ok",
    service: "DriveMind Backend",
    version: require("../../package.json").version || "1.0.0",
    uptime: process.uptime(),
    startedAt: startedAt.toISOString(),
    memoryUsage: process.memoryUsage(),
    connectedClients: typeof getConnectedClients === "function" ? getConnectedClients() : 0,
    timestamp: new Date(),
    databases: {
      mongodb: "unhealthy",
      neo4j: "unhealthy",
    },
    services: {
      backend: { status: "connected", latency: 0 },
      ai: { status: "disconnected", latency: null, error: null },
      mongodb: { status: "disconnected", latency: null, error: null },
      neo4j: { status: "disconnected", latency: null, error: null },
    },
  };

  // 1. Backend latency check
  const backendStart = Date.now();
  healthStatus.services.backend.latency = Date.now() - backendStart;

  // 2. AI Service check (FastAPI on Port 8000)
  const aiStart = Date.now();
  const aiUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
  try {
    const aiRes = await axios.get(`${aiUrl}/health`, { timeout: 1500 });
    healthStatus.services.ai.status = aiRes.status === 200 ? "connected" : "warning";
    healthStatus.services.ai.latency = Date.now() - aiStart;
    healthStatus.services.ai.modelLoaded = aiRes.data?.modelLoaded || false;
  } catch (err) {
    healthStatus.services.ai.status = "disconnected";
    healthStatus.services.ai.error = err.message;
    healthStatus.services.ai.latency = Date.now() - aiStart;
  }

  // 3. MongoDB check
  const mongoStart = Date.now();
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      healthStatus.services.mongodb.status = "connected";
      healthStatus.services.mongodb.latency = Date.now() - mongoStart;
      healthStatus.databases.mongodb = "healthy";
    } else {
      healthStatus.services.mongodb.status = "disconnected";
      healthStatus.services.mongodb.error = "MongoDB connection state is not active";
      healthStatus.services.mongodb.latency = Date.now() - mongoStart;
      healthStatus.databases.mongodb = "unhealthy";
    }
  } catch (err) {
    healthStatus.services.mongodb.status = "disconnected";
    healthStatus.services.mongodb.error = err.message;
    healthStatus.services.mongodb.latency = Date.now() - mongoStart;
    healthStatus.databases.mongodb = `unhealthy: ${err.message}`;
  }

  // 4. Neo4j check
  const neo4jStart = Date.now();
  const driver = getNeo4jDriver();
  if (driver) {
    const session = driver.session();
    try {
      await session.run("RETURN 1");
      healthStatus.services.neo4j.status = "connected";
      healthStatus.services.neo4j.latency = Date.now() - neo4jStart;
      healthStatus.databases.neo4j = "healthy";
    } catch (err) {
      healthStatus.services.neo4j.status = "disconnected";
      healthStatus.services.neo4j.error = err.message;
      healthStatus.services.neo4j.latency = Date.now() - neo4jStart;
      healthStatus.databases.neo4j = `unhealthy: ${err.message}`;
    } finally {
      await session.close();
    }
  } else {
    healthStatus.services.neo4j.status = "disconnected";
    healthStatus.services.neo4j.error = "Neo4j driver not initialized";
    healthStatus.services.neo4j.latency = Date.now() - neo4jStart;
    healthStatus.databases.neo4j = "uninitialized";
  }

  // If any critical service is offline, flag parent status as degraded
  const isHealthy = healthStatus.databases.mongodb === "healthy" && healthStatus.databases.neo4j === "healthy";
  healthStatus.status = isHealthy ? "ok" : "degraded";

  res.status(isHealthy ? 200 : 500).json(healthStatus);
});

module.exports = router;