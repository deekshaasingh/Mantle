require("dotenv").config();
const fs = require("fs");
fs.mkdirSync("uploads", { recursive: true });

const cors = require("cors");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cloudinary = require("cloudinary").v2;
const { connectDB, Upload } = require("./db");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

connectDB();

// Helper: upload an in-memory image buffer to Cloudinary, return its URL
function uploadToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, folder: "mantle", resource_type: "image" },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });
}

app.post("/upload", upload.single("image"), async (req, res) => {
  const inputPath = req.file.path;
  const format = ["jpg", "png", "webp"].includes(req.body.format) ? req.body.format : "jpg";
  const quality = Math.min(100, Math.max(10, parseInt(req.body.quality) || 80));
  const transforms = (req.body.transforms || "").split(",").filter(Boolean);

  const record = await Upload.create({
    originalFile: inputPath,
    format,
    quality,
    transforms,
    originalSize: req.file.size,
    status: "processing",
  });

  res.status(202).json({ id: record._id, status: "processing" });

  processInBackground(record._id, inputPath, req.file.filename, format, quality, transforms);
});

async function processInBackground(id, inputPath, filename, format, quality, transforms) {
  const start = Date.now();
  try {
    const meta = await sharp(inputPath).metadata();

    const sizes = { thumbnail: 200, desktop: 1280 };
    const processedFiles = {};
    let processedSize = 0;

    for (const [label, width] of Object.entries(sizes)) {
      let pipeline = sharp(inputPath).rotate();

      if (transforms.includes("grayscale")) pipeline = pipeline.grayscale();
      if (transforms.includes("blur")) pipeline = pipeline.blur(8);
      if (transforms.includes("rotate")) pipeline = pipeline.rotate(90);

      pipeline = pipeline.resize({ width });

      if (format === "jpg") pipeline = pipeline.jpeg({ quality });
      else if (format === "png") pipeline = pipeline.png({ quality });
      else if (format === "webp") pipeline = pipeline.webp({ quality });

      // produce the image in memory, then upload to Cloudinary
      const buffer = await pipeline.toBuffer();
      processedSize += buffer.length;
      const url = await uploadToCloudinary(buffer, `${filename}-${label}`);
      processedFiles[label] = url;
    }

    // remove the temporary uploaded original
    fs.unlink(inputPath, () => {});

    const record = await Upload.findById(id);
    const savedPercent = record.originalSize
      ? Math.round((1 - processedSize / record.originalSize) * 100)
      : 0;

    await Upload.updateOne(
      { _id: id },
      {
        status: "done",
        processedFiles,
        processedSize,
        savedPercent,
        processingMs: Date.now() - start,
        width: meta.width || 0,
        height: meta.height || 0,
      }
    );
    console.log(`Task ${id} done in ${Date.now() - start}ms`);
  } catch (err) {
    await Upload.updateOne({ _id: id }, { status: "failed", error: err.message });
    console.log(`Task ${id} failed:`, err);
  }
}

app.get("/status/:id", async (req, res) => {
  const record = await Upload.findById(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

app.get("/uploads", async (req, res) => {
  const records = await Upload.find().sort({ createdAt: -1 }).limit(20);
  res.json(records);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));