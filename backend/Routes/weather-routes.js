const express = require("express");
const router = express.Router();
const { getWeather, getSuggestion } = require("../Controllers/weather-controller.js");

router.get("/", getWeather);
router.post("/suggestion", getSuggestion);

module.exports = router;
