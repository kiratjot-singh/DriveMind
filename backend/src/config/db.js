const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = async (retries = 5, delay = 5000) => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    logger.warn("MongoDB URI not found. Database connection skipped.");
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(mongoURI);
      logger.info(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) {
        logger.error("Max MongoDB connection retries reached. Exiting process.");
        process.exit(1);
      }
      logger.info(`Retrying in ${delay / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

module.exports = connectDB;