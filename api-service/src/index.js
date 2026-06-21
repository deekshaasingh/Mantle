const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const { createLogger } = require("../../shared/logger");
const { connectDB, MediaTask } = require("../../shared/db");
const {
  connectQueue,
  EXCHANGES,
  ROUTING_KEYS,
} = require("../../shared/queue");

const logger = createLogger("api-service");

// --- Config from environment, with sensible local defaults ---
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mantle";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "../../public/uploads");

// Ensure the raw-upload directory exists on boot.
fs.mkdirSync(path.join(UPLOAD_DIR, "raw"), { recursive: true });

// --- Multer: save incoming files to disk with a unique name ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, "raw")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image uploads are allowed"));
  },
});

async function start() {
  await connectDB(MONGO_URI);
  logger.info("Connected to MongoDB");

  const { channel } = await connectQueue(RABBITMQ_URL, logger);

  const app = express();

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.post("/api/media/upload", upload.single("image"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const taskId = uuidv4();
    const userId = req.body.userId || "user-123";
    const rawUrl = `/uploads/raw/${req.file.filename}`;

    try {
      // 1. Persist a pending record BEFORE queueing, so the task is
      //    always trackable even if the publish step were to fail.
      await MediaTask.create({ taskId, userId, status: "pending", rawUrl });

      // 2. Publish the job. persistent:true survives a broker restart.
      channel.publish(
        EXCHANGES.MAIN,
        ROUTING_KEYS.PROCESS,
        Buffer.from(JSON.stringify({ taskId, userId, rawUrl })),
        { persistent: true, headers: { "x-retry-count": 0 } }
      );

      logger.info("Upload accepted and queued", { taskId, userId });

      // 3. Return 202 immediately — the work happens asynchronously.
      return res.status(202).json({ taskId, status: "pending" });
    } catch (err) {
      logger.error("Failed to accept upload", { taskId, error: err.message });
      return res.status(500).json({ error: "Failed to accept upload" });
    }
  });

  app.listen(PORT, () => logger.info("API service listening", { port: PORT }));
}

start().catch((err) => {
  logger.error("API service failed to start", { error: err.message });
  process.exit(1);
});