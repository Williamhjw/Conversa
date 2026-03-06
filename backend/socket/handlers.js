const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");
const {
  getAiResponse,
  sendMessageHandler,
  deleteMessageHandler,
} = require("../Controllers/message-controller.js");

// userSocketMap is Map<userId, Set<socketId>> injected from socket/index.js.
// It is used to determine whether a user still has any open connections before
// marking them offline, so closing one browser tab doesn't falsely show them
// as offline while another tab is still connected.
module.exports = (io, socket, userSocketMap) => {
  // socket.userId is set by the JWT auth middleware in socket/index.js.
  // We never trust a user-supplied ID for security-sensitive operations.
  const currentUserId = socket.userId;

  // ─── Setup ────────────────────────────────────────────────────────────────
  // Client calls this once after connecting to join their personal room and
  // announce they are online.
  socket.on("setup", async () => {
    try {
      socket.join(currentUserId);
      console.log("User joined personal room", currentUserId);
      socket.emit("user setup", currentUserId);

      await User.findByIdAndUpdate(currentUserId, { isOnline: true });

      const conversations = await Conversation.find({
        members: { $in: [currentUserId] },
      });

      conversations.forEach((conversation) => {
        const room = io.sockets.adapter.rooms.get(conversation.id);
        if (room) {
          io.to(conversation.id).emit("receiver-online", {
            userId: currentUserId,
          });
        }
      });
    } catch (error) {
      console.error("Error in setup handler:", error);
    }
  });

  // ─── Join chat room ────────────────────────────────────────────────────────
  socket.on("join-chat", async (data) => {
    try {
      const { roomId } = data;
      console.log("User joined chat room", roomId);

      const conv = await Conversation.findById(roomId);
      if (!conv) return;

      // Verify the authenticated user is actually a member of this conversation
      const isMember = conv.members.some(
        (m) => m.toString() === currentUserId
      );
      if (!isMember) {
        console.warn(
          `User ${currentUserId} tried to join conversation ${roomId} they are not a member of`
        );
        return;
      }

      socket.join(roomId);

      // Reset unread count for this user
      conv.unreadCounts = conv.unreadCounts.map((unread) => {
        if (unread.userId.toString() === currentUserId) {
          unread.count = 0;
        }
        return unread;
      });
      await conv.save({ timestamps: false });

      io.to(roomId).emit("user-joined-room", currentUserId);
    } catch (error) {
      console.error("Error in join-chat handler:", error);
    }
  });

  // ─── Leave chat room ───────────────────────────────────────────────────────
  socket.on("leave-chat", (room) => {
    socket.leave(room);
  });

  // ─── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = async (data) => {
    try {
      console.log("Received message");

      const { conversationId, text, imageUrl } = data;
      // Always use the authenticated user as the sender — never trust client-supplied senderId
      const senderId = currentUserId;

      const conversation = await Conversation.findById(conversationId).populate(
        "members"
      );
      if (!conversation) return;

      // Verify sender is a member of this conversation
      const isMember = conversation.members.some(
        (m) => m._id.toString() === senderId
      );
      if (!isMember) {
        console.warn(
          `User ${senderId} tried to send to conversation ${conversationId} they don't belong to`
        );
        return;
      }

      // ── AI bot processing ────────────────────────────────────────────────
      // Use the isBot field instead of an email-suffix heuristic.
      const botMember = conversation.members.find(
        (member) => member._id.toString() !== senderId && member.isBot
      );

      if (botMember) {
        const botId = botMember._id.toString();

        io.to(conversationId).emit("typing", { typer: botId });

        const mockUserMessage = {
          id_: Date.now().toString(),
          conversationId,
          senderId,
          text,
          seenBy: [{ user: botId, seenAt: new Date() }],
          imageUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        io.to(conversationId).emit("receive-message", mockUserMessage);

        const responseMessage = await getAiResponse(text, senderId, conversationId);

        if (responseMessage === null) {
          io.to(conversationId).emit("stop-typing", { typer: botId });
          return;
        }

        io.to(conversationId).emit("receive-message", responseMessage);
        io.to(conversationId).emit("stop-typing", { typer: botId });
        return;
      }

      // ── Personal chat processing ─────────────────────────────────────────
      const receiverMember = conversation.members.find(
        (member) => member._id.toString() !== senderId
      );
      if (!receiverMember) return;

      const receiverId = receiverMember._id;

      // Determine if the receiver currently has the conversation room open.
      // Check ALL of the receiver's sockets so multi-device is handled correctly.
      const receiverSocketIds = userSocketMap.get(receiverId.toString());
      let isReceiverInsideChatRoom = false;

      if (receiverSocketIds) {
        const conversationRoom = io.sockets.adapter.rooms.get(conversationId);
        if (conversationRoom) {
          isReceiverInsideChatRoom = Array.from(receiverSocketIds).some((sid) =>
            conversationRoom.has(sid)
          );
        }
      }

      const message = await sendMessageHandler({
        text,
        imageUrl,
        senderId,
        conversationId,
        receiverId,
        isReceiverInsideChatRoom,
      });

      io.to(conversationId).emit("receive-message", message);

      conversation.unreadCounts = conversation.unreadCounts.map((unread) => {
        if (unread.userId.toString() === receiverId.toString()) {
          return { userId: unread.userId, count: unread.count + 1 };
        }
        return unread;
      });

      conversation.latestmessage = text || "sent an image";

      if (!isReceiverInsideChatRoom) {
        console.log("Emitting new message notification to:", receiverId.toString());
        const senderInfo = conversation.members.find(
          (m) => m._id.toString() === senderId
        );
        io.to(receiverId.toString()).emit("new-message-notification", {
          message,
          sender: senderInfo,
          conversation: conversation
        });
      }
    } catch (error) {
      console.error("Error in send-message handler:", error);
    }
  };

  socket.on("send-message", handleSendMessage);

  // ─── Delete message ────────────────────────────────────────────────────────
  const handleDeleteMessage = async (data) => {
    try {
      const { messageId, deleteFrom, conversationId } = data;
      const deleted = await deleteMessageHandler({ messageId, deleteFrom });
      if (deleted && deleteFrom.length > 1) {
        io.to(conversationId).emit("message-deleted", data);
      }
    } catch (error) {
      console.error("Error in delete-message handler:", error);
    }
  };

  socket.on("delete-message", handleDeleteMessage);

  // ─── Typing indicators ─────────────────────────────────────────────────────
  // Helper: emit a typing event to everyone in the conversation room, and also
  // to the receiver's personal room if they are online but not currently viewing
  // this conversation (so they can show a subtle indicator in the chat list).
  const emitTypingEvent = (event, data) => {
    const { conversationId, receiverId } = data;

    // Always notify users already inside the room
    io.to(conversationId).emit(event, data);

    if (!receiverId) return;

    // Check if receiver is online
    const receiverSockets = userSocketMap.get(receiverId.toString());
    if (!receiverSockets || receiverSockets.size === 0) return; // offline

    // Check if ANY of their sockets are inside the conversation room
    const conversationRoom = io.sockets.adapter.rooms.get(conversationId);
    const isInsideRoom =
      conversationRoom &&
      Array.from(receiverSockets).some((sid) => conversationRoom.has(sid));

    if (!isInsideRoom) {
      // Online but not viewing this chat — emit to their personal room
      io.to(receiverId.toString()).emit(event, data);
    }
  };

  socket.on("typing", (data) => emitTypingEvent("typing", data));

  socket.on("stop-typing", (data) => emitTypingEvent("stop-typing", data));

  // ─── Disconnect ────────────────────────────────────────────────────────────
  // Only mark the user offline when ALL their sockets have disconnected
  // (i.e. they closed every tab/device), not just one of them.
  socket.on("disconnect", async () => {
    console.log("Socket disconnected", socket.id, "user:", currentUserId);
    try {
      // userSocketMap is updated by socket/index.js AFTER this event fires,
      // so at this point the disconnecting socket is still in the set.
      // size <= 1 means this is the last (or only) socket for the user.
      const sockets = userSocketMap.get(currentUserId);
      const isLastSocket = !sockets || sockets.size <= 1;

      if (!isLastSocket) {
        console.log(
          `User ${currentUserId} still has other sockets open — staying online`
        );
        return;
      }

      await User.findByIdAndUpdate(currentUserId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      const conversations = await Conversation.find({
        members: { $in: [currentUserId] },
      });

      conversations.forEach((conversation) => {
        const room = io.sockets.adapter.rooms.get(conversation.id);
        if (room) {
          io.to(conversation.id).emit("receiver-offline", {
            userId: currentUserId,
          });
        }
      });
    } catch (error) {
      console.error("Error updating user status on disconnect:", error);
    }
  });
};
