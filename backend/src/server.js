const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const helmet = require("helmet");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");

const logger = require("./config/logger");
const healthRoutes = require("./routes/healthRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const experienceRoutes = require("./routes/experienceRoutes");
const roadRiskRoutes = require("./routes/roadRiskRoutes");
const graphRoutes = require("./routes/graphRoutes");
const authRoutes = require("./routes/authRoutes");
const verifyAdmin = require("./middleware/authMiddleware");
const errorHandler = require("./middleware/errorHandler");
const connectDB = require("./config/db");
const { connectNeo4j } = require("./config/neo4j");
const { initSocket } = require("./services/socketService");

dotenv.config();

const log = logger.createModuleLogger("server");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

initSocket(io);

// ── Security & Parsing ────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ── Request timing logger middleware ──────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.originalUrl !== "/api/health") {
      log.info(
        `${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
      );
    }
  });
  next();
});

// ── Rate limiting for general API ────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    success: false,
    message: "Too many requests, please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api", apiLimiter);

// ── Rate limiting for telemetry endpoint ──────────────
const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Rate limit exceeded — max 120 requests per minute for telemetry",
  },
});

// ── Routes ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "DriveMind backend is running",
    version: require("../package.json").version || "1.0.0",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/telemetry", telemetryLimiter, telemetryRoutes);
app.use("/api/experiences", verifyAdmin, experienceRoutes);
app.use("/api/road-risk", verifyAdmin, roadRiskRoutes);
app.use("/api/graph", verifyAdmin, graphRoutes);

// Socket.io connection logging
io.on("connection", (socket) => {
  log.info(`Vehicle/dashboard connected: ${socket.id}`);

  socket.on("disconnect", () => {
    log.info(`Client disconnected: ${socket.id}`);
  });
});

// ── Centralized error handler (must be last) ──────────
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

// ── Start server ──────────────────────────────────────
const startServer = async () => {
  log.info("Initializing DriveMind backend databases...");
  await connectDB();
  await connectNeo4j();

  server.listen(PORT, () => {
    log.info(`DriveMind backend running on port ${PORT}`);
  });
};

startServer();

// ── Graceful shutdown ─────────────────────────────────
const gracefulShutdown = (signal) => {
  log.info(`Received shutdown signal (${signal}) — closing connections`);

  server.close(() => {
    log.info("HTTP server closed");
    io.close(() => {
      log.info("Socket.IO server closed");
      process.exit(0);
    });
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    log.warn("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle unhandled rejections
process.on("unhandledRejection", (reason) => {
  log.error(`Unhandled promise rejection: ${reason?.message || reason}`);
});
