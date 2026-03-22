const express = require("express");
const router = express.Router();
const { generateImage, checkImageGenStatus } = require("../Controllers/image-controller.js");
const fetchuser = require("../middleware/fetchUser.js");

// Generate image - requires authentication
router.post("/generate", fetchuser, generateImage);

// Check image generation status - public
router.get("/status", checkImageGenStatus);

module.exports = router;
