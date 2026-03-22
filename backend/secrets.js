const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "glm-4.5-air";
const IMAGE_GEN_MODEL = process.env.IMAGE_GEN_MODEL || "cogview-3";
const AMAP_API_KEY = process.env.AMAP_API_KEY;
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://conversa-chatting.netlify.app";

module.exports = {
  CORS_ORIGIN,
  MONGO_URI,
  MONGO_DB_NAME,
  JWT_SECRET,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  IMAGE_GEN_MODEL,
  AMAP_API_KEY,
  EMAIL,
  PASSWORD,
  FRONTEND_URL,
};
