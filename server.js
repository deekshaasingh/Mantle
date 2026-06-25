const express = require("express");
const multer = require("multer");
const sharp = require("sharp");

const app = express();
const upload = multer({ dest: "uploads/" });

// When someone POSTs a file to /upload, this runs
app.post("/upload", upload.single("image"), async (req, res) => {
  const inputPath = req.file.path;          // where multer saved the upload
  const outputPath = `processed/${req.file.filename}.jpg`;

  await sharp(inputPath)
    .resize({ width: 200 })
    .toFile(outputPath);

  res.json({ message: "Image processed!", output: outputPath });
});

app.listen(4000, () => console.log("Server running on http://localhost:4000"));