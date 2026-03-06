const { Server } = require("socket.io");
const registerHandlers = require("./handlers");
const { CORS_ORIGIN } = require("../secrets");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
  });
  console.log("Socket.io initialized");

  io.on("connection", (socket) => {
    console.log(`New connection: ${socket.id}`);
    registerHandlers(io, socket);
  });

  return io;
};

module.exports = { initSocket };
