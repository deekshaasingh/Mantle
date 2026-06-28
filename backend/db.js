require("dotenv").config();

const mongoose = require("mongoose");

// The "shape" of one upload record
const uploadSchema = new mongoose.Schema({
  status: { type: String, default: "processing" },
  originalFile: String,
  format: { type: String, default: "jpg" },
  quality: { type: Number, default: 80 },
  originalSize: { type: Number, default: 0 },
  processedSize: { type: Number, default: 0 },
  savedPercent: { type: Number, default: 0 },
  processingMs: { type: Number, default: 0 },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  transforms: { type: [String], default: [] },
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
async function connectDB(uri) {
  const target = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mantle";
  await mongoose.connect(target);
  console.log("Connected to MongoDB");
  return mongoose.connection;
}

module.exports = { connectDB, Upload };