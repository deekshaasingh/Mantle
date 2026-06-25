const mongoose = require("mongoose");

// The "shape" of one upload record
const uploadSchema = new mongoose.Schema({
  status: { type: String, default: "done" },
  originalFile: String,
  processedFile: String,
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