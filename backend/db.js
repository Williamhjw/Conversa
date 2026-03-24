const mongoose = require("mongoose");
const { MONGO_URI, MONGO_DB_NAME} = require("./secrets");

const connectDB = async () => {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI is not defined");
    console.log("⚠️ Starting server without database connection...");
    return false;
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      dbName: MONGO_DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    console.log("⚠️ Starting server without database connection...");
    return false;
  }
};

module.exports = connectDB;
