const { getWeather, getSuggestion } = require("../Services/weather-service.js");

const getWeatherHandler = async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: "缺少位置参数" });
    }

    const weatherData = await getWeather(lat, lon);
    res.json(weatherData);
  } catch (error) {
    console.error("Weather API error:", error.message);
    res.status(500).json({ error: error.message || "获取天气信息失败" });
  }
};

const getSuggestionHandler = async (req, res) => {
  try {
    const { temperature, feelsLike, humidity, windSpeed, description, location } = req.body;

    if (temperature === undefined) {
      return res.status(400).json({ error: "缺少天气数据" });
    }

    const weatherData = {
      temperature,
      feelsLike,
      humidity,
      windSpeed,
      description,
      location,
    };

    const suggestion = await getSuggestion(weatherData);
    res.json(suggestion);
  } catch (error) {
    console.error("Suggestion API error:", error.message);
    res.status(500).json({ error: "获取建议失败" });
  }
};

module.exports = {
  getWeather: getWeatherHandler,
  getSuggestion: getSuggestionHandler,
};
