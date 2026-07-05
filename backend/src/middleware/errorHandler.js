const { createModuleLogger } = require("../config/logger");

const log = createModuleLogger("errorHandler");

/**
 * Centralized Express error handler.
 * Must be registered AFTER all routes.
 * Provides consistent error response shape across all endpoints.
 */
const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  log.error(
    {
      err: {
        message: err.message,
        stack: isProduction ? undefined : err.stack,
        code: err.code,
      },
      method: req.method,
      url: req.originalUrl,
      statusCode,
    },
    `Unhandled error: ${err.message}`
  );

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_ERROR",
      message: isProduction
        ? "An internal error occurred"
        : err.message || "Unknown error",
    },
  });
};

module.exports = errorHandler;
