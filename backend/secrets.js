const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const QINIU_ACCESS_KEY = process.env.QINIU_ACCESS_KEY;
const QINIU_SECRET_KEY = process.env.QINIU_SECRET_KEY;
const QINIU_BUCKET = process.env.QINIU_BUCKET;
const QINIU_DOMAIN = process.env.QINIU_DOMAIN;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://conversa-chatting.netlify.app";

module.exports = {
  CORS_ORIGIN,
  MONGO_URI,
  MONGO_DB_NAME,
  JWT_SECRET,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  EMAIL,
  PASSWORD,
  QINIU_ACCESS_KEY,
  QINIU_SECRET_KEY,
  QINIU_BUCKET,
  QINIU_DOMAIN,
  FRONTEND_URL,
};
