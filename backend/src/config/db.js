const mongoose = require("mongoose");
const { createModuleLogger } = require("./logger");

const log = createModuleLogger("mongodb");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    log.warn("MongoDB URI not found — database connection skipped");
    return;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(mongoURI);
      log.info(
        { host: conn.connection.host, attempt },
        "MongoDB connected"
      );

      // Connection event listeners
      mongoose.connection.on("disconnected", () => {
        log.warn("MongoDB disconnected — Mongoose will auto-reconnect");
      });
      mongoose.connection.on("reconnected", () => {
        log.info("MongoDB reconnected");
      });
      mongoose.connection.on("error", (err) => {
        log.error({ err: err.message }, "MongoDB connection error");
      });

      return;
    } catch (error) {
      log.error(
        { attempt, maxRetries: MAX_RETRIES, error: error.message },
        `MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed`
      );

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        log.error("All MongoDB connection attempts exhausted — running in degraded mode");
      }
    }
  }
};

module.exports = connectDB;