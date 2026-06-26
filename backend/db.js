const mongoose = require("mongoose");

// The "shape" of one upload record
const uploadSchema = new mongoose.Schema({
  status: { type: String, default: "processing" }, // processing -> done -> failed
  originalFile: String,
  format: { type: String, default: "jpg" },
  quality: { type: Number, default: 80 },
  originalSize: { type: Number, default: 0 },     // bytes
  processedSize: { type: Number, default: 0 },    // bytes (sum of outputs)
  savedPercent: { type: Number, default: 0 },
  processingMs: { type: Number, default: 0 },
  processedFiles: {
    thumbnail: { type: String, default: null },
    desktop: { type: String, default: null },
  },
  error: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

// A model is how we create and find records of that shape
const Upload = mongoose.model("Upload", uploadSchema);

// Connect to the MongoDB running on your machine
async function connectDB() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mantle");
  console.log("Connected to MongoDB");
}

module.exports = { connectDB, Upload };