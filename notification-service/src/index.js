const http = require("http");
const { Server } = require("socket.io");

const { createLogger } = require("../../shared/logger");
const { connectQueue, QUEUES } = require("../../shared/queue");

const logger = createLogger("notification-service");

const PORT = process.env.PORT || 5000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";

async function start() {
  // Bare HTTP server purely to host Socket.io + a health endpoint.
  const httpServer = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok" }));
    }
    res.writeHead(404);
    res.end();
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    // Client tells us who it is, and we put it in a room named by userId.
    // Targeting a room lets us notify ONE user, not broadcast to all.
    const userId = socket.handshake.query.userId;
    if (userId) {
      socket.join(userId);
      logger.info("Client connected", { socketId: socket.id, userId });
    }
    socket.on("disconnect", () =>
      logger.info("Client disconnected", { socketId: socket.id, userId })
    );
  });

  const { channel } = await connectQueue(RABBITMQ_URL, logger);

  channel.consume(QUEUES.NOTIFICATIONS, (msg) => {
    if (!msg) return;
    const { taskId, userId, processedUrls } = JSON.parse(msg.content.toString());

    // Emit only to that user's room.
    io.to(userId).emit("media:ready", { taskId, processedUrls });
    channel.ack(msg);
    logger.info("Pushed media:ready event", { taskId, userId });
  });

  httpServer.listen(PORT, () =>
    logger.info("Notification service listening", { port: PORT })
  );
}

start().catch((err) => {
  logger.error("Notification service failed to start", { error: err.message });
  process.exit(1);
});