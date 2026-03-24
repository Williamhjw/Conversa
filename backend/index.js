const express = require("express");
const connectDB = require("./db.js");
const cors = require("cors");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const PORT = process.env.PORT || 5500;
const { initSocket } = require("./socket/index.js");
const { startStaleOnlineUsersJob } = require("./jobs/staleOnlineUsers.js");
const { CORS_ORIGIN } = require("./secrets.js");

const app = express();

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadsDir, req.user?.id || "anonymous");
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("仅支持图片文件"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(cors({
  origin: CORS_ORIGIN === "*" ? "*" : CORS_ORIGIN.split(",").map(s => s.trim()),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "auth-token"],
}));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

// Static files with CORS enabled
app.use("/uploads", cors({
  origin: CORS_ORIGIN === "*" ? "*" : CORS_ORIGIN.split(",").map(s => s.trim()),
  credentials: true,
}), express.static(uploadsDir, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
}));

// Routes
app.get("/", (req, res) => {
  res.send("Hello World");
});
app.use("/auth", require("./Routes/auth-routes.js"));
app.use("/user", require("./Routes/user-routes.js"));
app.use("/message", require("./Routes/message-routes.js"));
app.use("/conversation", require("./Routes/conversation-routes.js"));
app.use("/group", require("./Routes/group-routes.js"));
app.use("/leetcode", require("./Routes/leetcode-routes.js"));
app.use("/weather", require("./Routes/weather-routes.js"));
app.use("/image", require("./Routes/image-routes.js"));
app.use("/stock", require("./Routes/stock-routes.js"));

app.post("/upload", require("./middleware/fetchUser.js"), upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "没有上传文件" });
  }
  // Return full URL for consistency with avatar upload
  const protocol = req.protocol;
  const host = req.get("host");
  const serverUrl = `${protocol}://${host}`;
  const fileUrl = `${serverUrl}/uploads/${req.user.id}/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "文件大小不能超过 5MB" });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message === "仅支持图片文件") {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// Server setup
const server = http.createServer(app);

// Socket.io setup
initSocket(server); // Initialize socket.io logic

// Start server and connect to database
const start = async () => {
  try {
    await connectDB();
    startStaleOnlineUsersJob();
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
  
  // Always start server, even if database connection fails
  // 局域网访问使用 0.0.0.0，本地开发使用 127.0.0.1
  const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Server started at http://localhost:${PORT}`);
    console.log(`📡 Listening on ${HOST}:${PORT}`);
    console.log(`📱 局域网访问: http://192.168.3.51:${PORT}`);
  });
};

start();
