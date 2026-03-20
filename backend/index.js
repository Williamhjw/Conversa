const express = require("express");
const connectDB = require("./db.js");
const cors = require("cors");
const http = require("http");
const PORT = 5500;
const { initSocket } = require("./socket/index.js");
const { startStaleOnlineUsersJob } = require("./jobs/staleOnlineUsers.js");
const { CORS_ORIGIN } = require("./secrets.js");

const app = express();

app.use(cors({
  origin: CORS_ORIGIN === "*" ? "*" : CORS_ORIGIN.split(",").map(s => s.trim()),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "auth-token"],
}));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

// Routes
app.get("/", (req, res) => {
  res.send("Hello World");
});
app.use("/auth", require("./Routes/auth-routes.js"));
app.use("/user", require("./Routes/user-routes.js"));
app.use("/message", require("./Routes/message-routes.js"));
app.use("/conversation", require("./Routes/conversation-routes.js"));

// Server setup
const server = http.createServer(app);

// Socket.io setup
initSocket(server); // Initialize socket.io logic

// Start server and connect to database
const start = async () => {
  await connectDB();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server started at http://localhost:${PORT}`);
  });
  startStaleOnlineUsersJob();
};

start();
