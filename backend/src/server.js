const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

const logger = require("./config/logger");
const healthRoutes = require("./routes/healthRoutes");
const telemetryRoutes = require("./routes/telemetryRoutes");
const experienceRoutes = require("./routes/experienceRoutes");
const roadRiskRoutes = require("./routes/roadRiskRoutes");
const graphRoutes = require("./routes/graphRoutes");
const authRoutes = require("./routes/authRoutes");
const verifyAdmin = require("./middleware/authMiddleware");
const connectDB = require("./config/db");
const { connectNeo4j } = require("./config/neo4j");
const { initSocket } = require("./services/socketService");

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

initSocket(io);

app.use(cors());
app.use(express.json());

// Logger middleware for HTTP requests
app.use((req, reqRes, next) => {
  logger.http(`${req.method} ${req.url}`);
  next();
});

const rateLimit = require("express-rate-limit");
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

app.get("/", (req, res) => {
  res.json({
    message: "DriveMind backend is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/experiences", verifyAdmin, experienceRoutes);
app.use("/api/road-risk", verifyAdmin, roadRiskRoutes);
app.use("/api/graph", verifyAdmin, graphRoutes);

io.on("connection", (socket) => {
  logger.info(`Vehicle/dashboard connected: ${socket.id}`);

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  logger.info("Initializing DriveMind backend databases...");
  await connectDB();
  await connectNeo4j();

  server.listen(PORT, () => {
    logger.info(`DriveMind backend running on port ${PORT}`);
  });
};

startServer();