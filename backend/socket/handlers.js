const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");
const Message = require("../Models/Message.js");
const {
  streamAiResponse,
  sendMessage,
  deleteMessageHandler,
} = require("../Controllers/message-controller.js");
const sendMessageEmail = require("../utils/sendMessageEmail.js");

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

      // Collect unique friend IDs across all conversations
      const friendIds = new Set();
      conversations.forEach((conversation) => {
        conversation.members.forEach((memberId) => {
          if (memberId.toString() !== currentUserId) {
            friendIds.add(memberId.toString());
          }
        });
      });

      // Notify every online friend via their personal room
      friendIds.forEach((friendId) => {
        io.to(friendId).emit("user-online", { userId: currentUserId });
      });
    } catch (error) {
      console.error("Error in setup handler:", error);
    }
  });

  // ─── Join chat room ────────────────────────────────────────────────────────
  socket.on("join-chat", async (data) => {
    try {
      const { roomId } = data;
      console.log(`User ${currentUserId} joined chat room ${roomId}`);

      const conv = await Conversation.findById(roomId);
      if (!conv) return;

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
      console.log(`User ${currentUserId} successfully joined room ${roomId}`);

      // Reset unread count for this user
      conv.unreadCounts = conv.unreadCounts.map((unread) => {
        if (unread.userId.toString() === currentUserId) {
          unread.count = 0;
        }
        return unread;
      });
      await conv.save({ timestamps: false });

      // Mark all unseen messages in this conversation as seen by this user
      const seenAt = new Date();
      await Message.updateMany(
        {
          conversationId: roomId,
          senderId: { $ne: currentUserId },
          hiddenFrom: { $ne: currentUserId },
          "seenBy.user": { $ne: currentUserId },
        },
        { $push: { seenBy: { user: currentUserId, seenAt } } }
      );

      // Notify the sender(s) in this room that their messages were seen
      io.to(roomId).emit("messages-seen", {
        conversationId: roomId,
        seenBy: currentUserId,
        seenAt,
      });

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

      const { conversationId, text, imageUrl, replyTo } = data;
      const senderId = currentUserId;

      const conversation = await Conversation.findById(conversationId).populate(
        "members"
      );
      if (!conversation) return;

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
      const botMember = conversation.members.find(
        (member) => member._id.toString() !== senderId && member.isBot
      );

      if (botMember) {
        const botId = botMember._id.toString();
        
        // Handle image generation result from bot (imageUrl present but text indicates generation)
        if (imageUrl && text?.includes("✨ 已为您生成图片")) {
          // Save bot's image message
          const botMessage = await Message.create({
            conversationId,
            senderId: botId,
            text,
            imageUrl,
          });
          
          await botMessage.populate('senderId', 'name profilePic');
          
          // Update conversation
          conversation.latestmessage = "AI生成了一张图片";
          await conversation.save();
          
          // Emit to room
          io.to(conversationId).emit("receive-message", botMessage);
          return;
        }
        
        // Handle error message from bot
        if (text?.includes("❌ 图片生成失败")) {
          const botMessage = await Message.create({
            conversationId,
            senderId: botId,
            text,
          });
          
          await botMessage.populate('senderId', 'name profilePic');
          
          conversation.latestmessage = text;
          await conversation.save();
          
          io.to(conversationId).emit("receive-message", botMessage);
          return;
        }
        
        // Handle user's image generation request - just save the message, skip AI response
        // The actual image generation is handled by the frontend API call
        if (text?.startsWith("🎨 生成图片：")) {
          const userMessage = await Message.create({
            conversationId,
            senderId,
            text,
          });
          
          await userMessage.populate('senderId', 'name profilePic');
          
          conversation.latestmessage = text;
          await conversation.save();
          
          io.to(conversationId).emit("receive-message", userMessage);
          return;
        }
        
        // Normal text streaming for chat
        const tempId = `bot-stream-${Date.now()}`;

        try {
          for await (const event of streamAiResponse(text, senderId, conversationId)) {
            if (event.type === "user-message") {
              io.to(conversationId).emit("receive-message", event.message);
              io.to(conversationId).emit("typing", { typer: botId, conversationId });
            } else if (event.type === "chunk") {
              io.to(conversationId).emit("bot-chunk", { conversationId, tempId, chunk: event.text });
            } else if (event.type === "done") {
              io.to(conversationId).emit("stop-typing", { typer: botId, conversationId });
              io.to(conversationId).emit("bot-done", { conversationId, tempId, message: event.message });
            } else if (event.type === "error") {
              io.to(conversationId).emit("stop-typing", { typer: botId, conversationId });
              io.to(conversationId).emit("bot-error", {
                conversationId,
                userMessageId: event.userMessageId ?? null,
              });
            }
          }
        } catch (err) {
          console.error("Bot streaming error:", err);
          io.to(conversationId).emit("stop-typing", { typer: botId, conversationId });
          io.to(conversationId).emit("bot-error", { conversationId, userMessageId: null });
        }
        return;
      }

      // ── Group chat processing ────────────────────────────────────────────
      if (conversation.isGroup) {
        const conversationRoom = io.sockets.adapter.rooms.get(conversationId);
        const senderSocketIds = userSocketMap.get(senderId);

        // Check which members are currently in the room
        const membersInRoom = new Set();
        if (conversationRoom) {
          for (const [userId, socketIds] of userSocketMap) {
            const isInRoom = Array.from(socketIds).some((sid) =>
              conversationRoom.has(sid)
            );
            if (isInRoom) {
              membersInRoom.add(userId);
            }
          }
        }

        // Check if sender is in room
        let senderInRoom = false;
        if (senderSocketIds && conversationRoom) {
          senderInRoom = Array.from(senderSocketIds).some((sid) =>
            conversationRoom.has(sid)
          );
        }

        // Create message with proper seenBy for members in room
        const seenByMembers = Array.from(membersInRoom).map((userId) => ({
          user: userId,
          seenAt: new Date(),
        }));

        const message = await Message.create({
          conversationId,
          senderId,
          text,
          imageUrl,
          seenBy: seenByMembers,
          ...(replyTo && { replyTo }),
        });

        // Update conversation
        conversation.latestmessage = text || "发送了一张图片";

        // Update unread counts only for members NOT in room (excluding sender)
        conversation.unreadCounts = conversation.unreadCounts.map((unread) => {
          const userId = unread.userId.toString();
          if (userId !== senderId && !membersInRoom.has(userId)) {
            return { ...unread, count: unread.count + 1 };
          }
          return unread;
        });

        await conversation.save();
        await message.populate('replyTo', 'text imageUrl senderId softDeleted');

        console.log(`Group message saved: ${message._id}, conversationId: ${conversationId}, senderId: ${senderId}`);

        io.to(conversationId).emit("receive-message", message);

        // Send to sender if not in room
        if (!senderInRoom) {
          io.to(senderId).emit("receive-message", message);
        }

        const senderInfo = conversation.members.find(
          (m) => m._id.toString() === senderId
        );

        const updatedConversation = await Conversation.findById(conversationId).populate("members");

        const otherMembers = conversation.members.filter(
          (m) => m._id.toString() !== senderId
        );

        for (const member of otherMembers) {
          const memberId = member._id.toString();
          const memberSocketIds = userSocketMap.get(memberId);
          const memberInRoom = membersInRoom.has(memberId);

          if (!memberInRoom) {
            io.to(memberId).emit("receive-message", message);
            io.to(memberId).emit("new-message-notification", {
              message,
              sender: senderInfo,
              conversation: updatedConversation
            });
          }

          if (!memberSocketIds || memberSocketIds.size === 0) {
            const memberDoc = await User.findById(memberId, "emailNotificationsEnabled email name");
            if (memberDoc?.emailNotificationsEnabled && memberDoc?.email) {
              sendMessageEmail(
                { name: memberDoc.name, email: memberDoc.email },
                { name: senderInfo.name, profilePic: senderInfo.profilePic },
                text || null,
                conversationId
              );
            }
          }
        }

        return;
      }

      // ── Personal chat processing ─────────────────────────────────────────
      const receiverMember = conversation.members.find(
        (member) => member._id.toString() !== senderId
      );
      if (!receiverMember) return;

      const receiverId = receiverMember._id;

      // ── Block check ───────────────────────────────────────────────────────
      const [receiverDoc, senderDoc] = await Promise.all([
        User.findById(receiverId, "blockedUsers emailNotificationsEnabled email name"),
        User.findById(senderId, "blockedUsers"),
      ]);
      const isBlockedByReceiver = receiverDoc?.blockedUsers?.some(
        (id) => id.toString() === senderId
      );
      const senderBlockedReceiver = senderDoc?.blockedUsers?.some(
        (id) => id.toString() === receiverId.toString()
      );
      if (isBlockedByReceiver || senderBlockedReceiver) {
        socket.emit("message-blocked", { conversationId });
        return;
      }

      // Determine if the receiver currently has the conversation room open.
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

      const message = await sendMessage({
        text,
        imageUrl,
        senderId,
        conversationId,
        receiverId,
        isReceiverInsideChatRoom,
        replyTo: replyTo || null,
      });

      console.log(`Message saved: ${message._id}, conversationId: ${conversationId}, senderId: ${senderId}, receiverId: ${receiverId}`);

      const conversationRoom = io.sockets.adapter.rooms.get(conversationId);
      console.log(`Room ${conversationId} has ${conversationRoom?.size || 0} sockets`);

      io.to(conversationId).emit("receive-message", message);
      console.log(`Emitted receive-message to room ${conversationId}`);

      const senderSocketIds = userSocketMap.get(senderId);
      if (senderSocketIds) {
        const senderInRoom = conversationRoom && Array.from(senderSocketIds).some((sid) => conversationRoom.has(sid));
        console.log(`Sender ${senderId} in room: ${senderInRoom}, sender sockets: ${senderSocketIds.size}`);
        if (!senderInRoom) {
          io.to(senderId).emit("receive-message", message);
          console.log(`Emitted receive-message to sender ${senderId}`);
        }
      }

      io.to(receiverId.toString()).emit("receive-message", message);
      console.log(`Emitted receive-message to receiver ${receiverId}`);

      if (!isReceiverInsideChatRoom) {
        console.log("Emitting new message notification to:", receiverId.toString());
        const senderInfo = conversation.members.find(
          (m) => m._id.toString() === senderId
        );
        const updatedConversation = await Conversation.findById(conversationId).populate("members");
        io.to(receiverId.toString()).emit("new-message-notification", {
          message,
          sender: senderInfo,
          conversation: updatedConversation
        });

        const isReceiverOffline = !receiverSocketIds || receiverSocketIds.size === 0;
        if (isReceiverOffline && receiverDoc?.emailNotificationsEnabled && receiverDoc?.email) {
          sendMessageEmail(
            { name: receiverDoc.name, email: receiverDoc.email },
            { name: senderInfo.name, profilePic: senderInfo.profilePic },
            text || null,
            conversationId
          );
        }
      }
    } catch (error) {
      console.error("Error in send-message handler:", error);
    }
  };

  socket.on("send-message", handleSendMessage);

  socket.on("leave-chat", (room) => {
    console.log(`User ${currentUserId} leaving room ${room}`);
    socket.leave(room);
  });
  // scope="everyone": soft-delete → shows tombstone to all. Broadcast to room.
  // scope="me":       hard-delete for sender only → no broadcast (only caller hides it).
  const handleDeleteMessage = async (data) => {
    try {
      const { messageId, conversationId, scope } = data;
      const updated = await deleteMessageHandler({
        messageId,
        scope,
        requesterId: currentUserId,
      });
      if (!updated) return;

      if (scope === 'everyone') {
        // Find the newest non-tombstone message to determine the new preview text
        const latestNonDeleted = await Message.findOne({
          conversationId,
          softDeleted: { $ne: true },
        }).sort({ createdAt: -1 });

        // If the tombstone is newer (or no other messages exist) → show tombstone text
        const newLatest =
          !latestNonDeleted ||
          new Date(updated.createdAt) >= new Date(latestNonDeleted.createdAt)
            ? '此消息已删除'
            : latestNonDeleted.text || '发送了一张图片';

        // Persist new preview to the conversation document
        await Conversation.findByIdAndUpdate(
          conversationId,
          { latestmessage: newLatest },
          { timestamps: false }
        );

        // Broadcast to every member so they see the tombstone + updated preview in real-time
        io.to(conversationId).emit('message-deleted', {
          messageId,
          conversationId,
          softDeleted: true,
          latestmessage: newLatest,
        });
      } else {
        // scope="me": find the new latest message visible to this user only
        const latestVisible = await Message.findOne({
          conversationId,
          hiddenFrom: { $ne: currentUserId },
        }).sort({ createdAt: -1 });

        const newLatest = latestVisible
          ? (latestVisible.softDeleted ? '此消息已删除' : (latestVisible.text || '发送了一张图片'))
          : '';

        // Only emit to the requester so their sidebar preview updates
        socket.emit('message-deleted', {
          messageId,
          conversationId,
          softDeleted: false,
          latestmessage: newLatest,
        });
      }
    } catch (error) {
      console.error('Error in delete-message handler:', error);
    }
  };

  socket.on('delete-message', handleDeleteMessage);

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

      // Collect unique friend IDs across all conversations
      const friendIds = new Set();
      conversations.forEach((conversation) => {
        conversation.members.forEach((memberId) => {
          if (memberId.toString() !== currentUserId) {
            friendIds.add(memberId.toString());
          }
        });
      });

      // Notify every online friend via their personal room
      friendIds.forEach((friendId) => {
        io.to(friendId).emit("user-offline", { userId: currentUserId });
      });
    } catch (error) {
      console.error("Error updating user status on disconnect:", error);
    }
  });
};
