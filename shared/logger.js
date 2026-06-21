const winston = require("winston");

/**
 * Factory that builds a Winston logger pre-tagged with the service name.
 * Every log line is emitted as a single JSON object so log aggregators
 * (Datadog, ELK, CloudWatch) can index and filter on individual fields
 * such as `taskId` and `service`.
 */
function createLogger(serviceName) {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    defaultMeta: { service: serviceName },
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [new winston.transports.Console()],
  });
}

module.exports = { createLogger };