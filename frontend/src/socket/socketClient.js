import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5001";

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});

/**
 * Returns the current Socket.IO connection state.
 */
export const getConnectionState = () => ({
  connected: socket.connected,
  id: socket.id,
});