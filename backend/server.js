const fs = require("fs");
fs.mkdirSync("uploads", { recursive: true });
fs.mkdirSync("processed", { recursive: true });

const cors = require("cors");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { connectDB, Upload } = require("./db");

const app = express();
app.use(cors());
app.use("/processed", express.static("processed"));

const upload = multer({ dest: "uploads/" });

connectDB();

app.post("/upload", upload.single("image"), async (req, res) => {
  const inputPath = req.file.path;
  const format = ["jpg", "png", "webp"].includes(req.body.format) ? req.body.format : "jpg";
  const quality = Math.min(100, Math.max(10, parseInt(req.body.quality) || 80));

  const record = await Upload.create({
    originalFile: inputPath,
    format,
    quality,
    originalSize: req.file.size,
    status: "processing",
  });

  res.status(202).json({ id: record._id, status: "processing" });

  processInBackground(record._id, inputPath, req.file.filename, format, quality);
});

async function processInBackground(id, inputPath, filename, format, quality) {
  const start = Date.now();
  try {
    const sizes = { thumbnail: 200, desktop: 1280 };
    const processedFiles = {};
    let processedSize = 0;

    for (const [label, width] of Object.entries(sizes)) {
      const outputPath = `processed/${filename}-${label}.${format}`;
      let pipeline = sharp(inputPath).resize({ width });

      if (format === "jpg") pipeline = pipeline.jpeg({ quality });
      else if (format === "png") pipeline = pipeline.png({ quality });
      else if (format === "webp") pipeline = pipeline.webp({ quality });

      const info = await pipeline.toFile(outputPath);
      processedFiles[label] = outputPath;
      processedSize += info.size;
    }

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
      }
    );
    console.log(`Task ${id} done in ${Date.now() - start}ms`);
  } catch (err) {
    await Upload.updateOne({ _id: id }, { status: "failed", error: err.message });
    console.log(`Task ${id} failed: ${err.message}`);
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

app.listen(4000, () => console.log("Server running on http://localhost:4000"));