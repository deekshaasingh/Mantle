const mongoose = require("mongoose");

/**
 * The MediaTask document tracks one upload through its entire lifecycle.
 * status is constrained to an enum so the document can never enter an
 * invalid state — this is effectively a state machine in the schema.
 */
const mediaTaskSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    rawUrl: { type: String, required: true },
    processedUrls: {
      thumbnail: { type: String, default: null },
      desktop: { type: String, default: null },
    },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

const MediaTask = mongoose.model("MediaTask", mediaTaskSchema);

/**
 * Connect once at service startup. Mongoose maintains an internal
 * connection pool, so every service calls this exactly once on boot.
 */
async function connectDB(uri) {
  await mongoose.connect(uri);
  return mongoose.connection;
}

module.exports = { connectDB, MediaTask };