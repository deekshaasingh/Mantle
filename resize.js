const sharp = require("sharp");

sharp("input.jpg")
  .resize({ width: 200 })
  .toFile("output.jpg")
  .then(() => console.log("Done! Created output.jpg"));