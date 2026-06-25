const amqp = require("amqplib");

// --- Topology constant names (single source of truth) ---
const EXCHANGES = {
  MAIN: "media_exchange",
  RETRY: "media_retry_exchange",
  FAILED: "media_failed_exchange",
};

const QUEUES = {
  PROCESSING: "media_processing_queue",
  RETRY: "media_retry_queue",
  FAILED: "media_failed_queue",
  NOTIFICATIONS: "notifications_queue",
};

const ROUTING_KEYS = {
  PROCESS: "media.process",
  NOTIFY: "media.notify",
};

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 5000;

/**
 * Establishes the full RabbitMQ topology. Idempotent: asserting an
 * exchange/queue that already exists is a no-op, so every service can
 * safely call this on startup.
 *
 * The retry loop works like this:
 *   main queue --(worker nacks)--> retry exchange --> retry queue
 *   retry queue has a TTL; on expiry the message dead-letters back to
 *   the main exchange --> main queue, triggering another attempt.
 */
async function setupTopology(channel) {
  // Exchanges
  await channel.assertExchange(EXCHANGES.MAIN, "direct", { durable: true });
  await channel.assertExchange(EXCHANGES.RETRY, "direct", { durable: true });
  await channel.assertExchange(EXCHANGES.FAILED, "direct", { durable: true });

  // Main processing queue. Rejected messages dead-letter to the RETRY exchange.
  await channel.assertQueue(QUEUES.PROCESSING, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": EXCHANGES.RETRY,
      "x-dead-letter-routing-key": ROUTING_KEYS.PROCESS,
    },
  });
  await channel.bindQueue(QUEUES.PROCESSING, EXCHANGES.MAIN, ROUTING_KEYS.PROCESS);

  // Retry queue: messages sit here until TTL expires, then dead-letter
  // back to the MAIN exchange for reprocessing.
  await channel.assertQueue(QUEUES.RETRY, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": EXCHANGES.MAIN,
      "x-dead-letter-routing-key": ROUTING_KEYS.PROCESS,
    },
  });
  await channel.bindQueue(QUEUES.RETRY, EXCHANGES.RETRY, ROUTING_KEYS.PROCESS);

  // Failed queue: terminal parking lot for poison messages.
  await channel.assertQueue(QUEUES.FAILED, { durable: true });
  await channel.bindQueue(QUEUES.FAILED, EXCHANGES.FAILED, ROUTING_KEYS.PROCESS);

  // Notifications queue: worker publishes here, notification service consumes.
  await channel.assertQueue(QUEUES.NOTIFICATIONS, { durable: true });
  await channel.bindQueue(
    QUEUES.NOTIFICATIONS,
    EXCHANGES.MAIN,
    ROUTING_KEYS.NOTIFY
  );
}

/**
 * Connects to RabbitMQ with a simple retry-on-boot loop, because in Docker
 * the API/worker often start before RabbitMQ is ready to accept connections.
 */
async function connectQueue(url, logger, attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      await setupTopology(channel);
      logger.info("Connected to RabbitMQ and asserted topology");
      return { connection, channel };
    } catch (err) {
      logger.warn("RabbitMQ connection failed, retrying", {
        attempt: i,
        maxAttempts: attempts,
        error: err.message,
      });
      if (i === attempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

module.exports = {
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
  MAX_RETRIES,
  BASE_RETRY_DELAY_MS,
  setupTopology,
  connectQueue,
};