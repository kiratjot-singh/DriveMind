const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
  base: { service: "drivemind-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

/**
 * Create a child logger scoped to a specific module.
 * Usage: const log = createModuleLogger("telemetryController");
 */
const createModuleLogger = (moduleName) => logger.child({ module: moduleName });

module.exports = { logger, createModuleLogger };
