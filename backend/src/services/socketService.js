const { createModuleLogger } = require("../config/logger");

const log = createModuleLogger("socketService");

let ioInstance = null;
let connectedClients = 0;

const initSocket = (io) => {
  ioInstance = io;

  io.on("connection", (socket) => {
    connectedClients++;
    log.info(
      { socketId: socket.id, connectedClients },
      "Client connected"
    );

    socket.on("disconnect", () => {
      connectedClients--;
      log.info(
        { socketId: socket.id, connectedClients },
        "Client disconnected"
      );
    });
  });

  log.info("Socket.IO service initialized");
};

const emitRiskAlert = (alertData) => {
  if (!ioInstance) {
    log.warn("Socket.IO not initialized — risk alert not emitted");
    return;
  }
  ioInstance.emit("risk-alert", alertData);
  log.info(
    { vehicleId: alertData.vehicleId, riskLevel: alertData.riskLevel },
    "Risk alert broadcast"
  );
};

const emitTelemetryProcessed = (data) => {
  if (!ioInstance) return;
  ioInstance.emit("telemetry-processed", data);
};

/**
 * Send a targeted event to a specific vehicle's socket room.
 */
const emitToVehicle = (vehicleId, event, data) => {
  if (!ioInstance) return;
  ioInstance.to(vehicleId).emit(event, data);
};

const getConnectedClients = () => connectedClients;

module.exports = {
  initSocket,
  emitRiskAlert,
  emitTelemetryProcessed,
  emitToVehicle,
  getConnectedClients,
};