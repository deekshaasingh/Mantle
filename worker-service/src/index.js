const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const { createLogger } = require("../../shared/logger");
const { connectDB, MediaTask } = require("../../shared/db");
const {
  connectQueue,
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
  MAX_RETRIES,
  BASE_RETRY_DELAY_MS,
} = require("../../shared/queue");

const logger = createLogger("worker-service");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mantle";
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "../../public/uploads");

// Output sizes: thumbnail vs desktop = "multiple formats"
const SIZES = {
  thumbnail: 200,
  desktop: 1280,
};

fs.mkdirSync(path.join(UPLOAD_DIR, "processed"), { recursive: true });

/**
 * The actual heavy work: read the raw file, produce a resized + compressed
 * version for each target size, return the public URLs.
 */
async function processImage(taskId, rawUrl) {
  const rawPath = path.join(UPLOAD_DIR, rawUrl.replace("/uploads/", ""));
  const processedUrls = {};

  for (const [label, width] of Object.entries(SIZES)) {
    const outName = `${taskId}-${label}.webp`;
    const outPath = path.join(UPLOAD_DIR, "processed", outName);

    await sharp(rawPath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outPath);

    processedUrls[label] = `/uploads/processed/${outName}`;
  }

  return processedUrls;
}

async function start() {
  await connectDB(MONGO_URI);
  logger.info("Connected to MongoDB");

  const { channel } = await connectQueue(RABBITMQ_URL, logger);

  // Fair dispatch: only one unacked message at a time per worker.
  channel.prefetch(1);

  channel.consume(QUEUES.PROCESSING, async (msg) => {
    if (!msg) return;

    const { taskId, userId, rawUrl } = JSON.parse(msg.content.toString());
    const retryCount = msg.properties.headers["x-retry-count"] || 0;

    logger.info("Processing task", { taskId, retryCount });

    try {
      await MediaTask.updateOne({ taskId }, { status: "processing" });

      const processedUrls = await processImage(taskId, rawUrl);

      await MediaTask.updateOne(
        { taskId },
        { status: "completed", processedUrls }
      );

      // Tell the notification service the result is ready.
      channel.publish(
        EXCHANGES.MAIN,
        ROUTING_KEYS.NOTIFY,
        Buffer.from(JSON.stringify({ taskId, userId, processedUrls })),
        { persistent: true }
      );

      channel.ack(msg);
      logger.info("Task completed", { taskId, processedUrls });
    } catch (err) {
      logger.error("Task processing failed", {
        taskId,
        retryCount,
        error: err.message,
      });

      if (retryCount < MAX_RETRIES) {
        // Exponential backoff: 5s, 25s, 125s ...
        const delay = BASE_RETRY_DELAY_MS * Math.pow(5, retryCount);

        channel.publish(
          EXCHANGES.RETRY,
          ROUTING_KEYS.PROCESS,
          msg.content,
          {
            persistent: true,
            expiration: String(delay),
            headers: { "x-retry-count": retryCount + 1 },
          }
        );
        channel.ack(msg);
        logger.warn("Task scheduled for retry", { taskId, delay, nextAttempt: retryCount + 1 });
      } else {
        await MediaTask.updateOne(
          { taskId },
          { status: "failed", error: err.message }
        );
        channel.publish(EXCHANGES.FAILED, ROUTING_KEYS.PROCESS, msg.content, {
          persistent: true,
        });
        channel.ack(msg);
        logger.error("Task permanently failed", { taskId });
      }
    }
  });

  logger.info("Worker listening for tasks", { queue: QUEUES.PROCESSING });
}

start().catch((err) => {
  logger.error("Worker failed to start", { error: err.message });
  process.exit(1);
});