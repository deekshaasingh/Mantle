const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { connectDB, Upload } = require("./db");

const app = express();
const upload = multer({ dest: "uploads/" });

connectDB(); // open the database connection when the server starts

app.post("/upload", upload.single("image"), async (req, res) => {
  const inputPath = req.file.path;
  const outputPath = `processed/${req.file.filename}.jpg`;

  await sharp(inputPath)
    .resize({ width: 200 })
    .toFile(outputPath);

  // Save a record of this upload to the database
  const record = await Upload.create({
    originalFile: inputPath,
    processedFile: outputPath,
  });

  res.json({ message: "Image processed!", id: record._id, output: outputPath });
});

app.listen(4000, () => console.log("Server running on http://localhost:4000"));