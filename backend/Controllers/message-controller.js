const Message = require("../Models/Message.js");
const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");
const {
  GLM_MODEL,
  GLM_API_KEY,
} = require("../secrets.js");

const translateMessage = async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供要翻译的文本' });
    }

    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          {
            role: "system",
            content: "你是一个专业的翻译助手。请将用户发送的文本翻译成中文。如果文本已经是中文，请直接返回原文。只返回翻译结果，不要添加任何解释或额外内容。"
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Translation API error:", errorText);
      return res.status(500).json({ error: '翻译服务暂时不可用' });
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content || text;
    
    res.json({ translatedText });
  } catch (error) {
    console.error("Translation error:", error.message);
    res.status(500).json({ error: '翻译失败，请稍后重试' });
  }
};

const allMessage = async (req, res) => {
  try {
    // Verify the requesting user is a member of this conversation
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const isMember = conversation.members.some(
      (m) => m.toString() === req.user.id
    );
    if (!isMember) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Mark all unseen messages as seen in a single bulk write
    await Message.updateMany(
      {
        conversationId: req.params.id,
        hiddenFrom: { $ne: req.user.id },
        "seenBy.user": { $ne: req.user.id },
      },
      { $push: { seenBy: { user: req.user.id, seenAt: new Date() } } }
    );

    const messages = await Message.find({
      conversationId: req.params.id,
      hiddenFrom: { $ne: req.user.id },
    })
      .populate('replyTo', 'text imageUrl senderId softDeleted')
      .populate('senderId', 'name profilePic')
      .lean();

    // Sanitize soft-deleted messages before sending to client:
    // replace content with tombstone text so the real content
    // is never exposed in the network response.
    const sanitized = messages.map((msg) => {
      if (!msg.softDeleted) return msg;
      return {
        ...msg,
        text: "此消息已删除",
        imageUrl: undefined,
      };
    });

    res.json(sanitized);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

/**
 * DELETE /api/message/:id
 * body: { scope: "me" | "everyone" }
 *
 * scope="everyone"  — soft-delete: sets softDeleted=true, visible to all as tombstone.
 *                     Only the original sender may do this.
 * scope="me"        — hard-delete for caller: adds caller to hiddenFrom so the
 *                     message (or tombstone) is skipped when queried for them.
 *                     Available for both own and received messages.
 */
const deleteMessage = async (req, res) => {
  const { scope } = req.body;
  if (!scope || !['me', 'everyone'].includes(scope)) {
    return res.status(400).json({ error: 'scope must be "me" or "everyone"' });
  }
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (scope === 'everyone') {
      // Only the original sender can soft-delete for everyone
      if (message.senderId.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Only the sender can delete for everyone' });
      }
      message.softDeleted = true;
    } else {
      // scope === 'me': hide from requester only
      const alreadyHidden = message.hiddenFrom.some(
        (id) => id.toString() === req.user.id
      );
      if (!alreadyHidden) message.hiddenFrom.push(req.user.id);
    }

    await message.save();
    res.status(200).json(message);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * POST /api/message/clear/:conversationId
 * Adds the requesting user to hiddenFrom for every message in the conversation,
 * effectively clearing the entire chat history from their view.
 */
const clearChat = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const isMember = conversation.members.some(
      (m) => m.toString() === req.user.id
    );
    if (!isMember) return res.status(403).json({ error: 'Forbidden' });

    await Message.updateMany(
      {
        conversationId: req.params.conversationId,
        hiddenFrom: { $ne: req.user.id },
      },
      { $push: { hiddenFrom: req.user.id } }
    );

    res.status(200).json({ message: 'Chat cleared' });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Async generator that:
 * 1. Saves the user message to DB immediately → yields { type: "user-message", message }
 * 2. Streams the GLM-4 response chunk-by-chunk → yields { type: "chunk", text }
 * 3. Saves the completed bot message → yields { type: "done", message }
 * Yields { type: "error" } on failure so the caller can clean up.
 */
const streamAiResponse = async function* (text, senderId, conversationId) {
  const conv = await Conversation.findById(conversationId);
  const botMember = await User.findOne({
    _id: { $in: conv.members },
    isBot: true,
  });
  if (!botMember) { yield { type: "error" }; return; }
  const botId = botMember._id;

  // Save user message first so it gets a real _id
  const userMessage = await Message.create({
    conversationId,
    senderId,
    text,
    seenBy: [{ user: botId, seenAt: new Date() }],
  });
  yield { type: "user-message", message: userMessage };

  // Build chat history (skip the message we just saved and image-only messages)
  const messagelist = await Message.find({
    conversationId,
    _id: { $ne: userMessage._id },
    text: { $exists: true, $ne: null },
  })
    .sort({ createdAt: -1 })
    .limit(19);

  const history = messagelist
    .reverse()
    .map((m) => ({
      role: m.senderId.toString() === senderId.toString() ? "user" : "assistant",
      content: m.text,
    }));

  let fullText = "";
  try {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          ...history,
          { role: "user", content: text }
        ],
        stream: true,
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GLM API error:", errorText);
      await Message.findByIdAndDelete(userMessage._id);
      yield { type: "error", userMessageId: userMessage._id.toString() };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              fullText += content;
              yield { type: "chunk", text: content };
            }
          } catch (e) {
            // Ignore parse errors for empty lines
          }
        }
      }
    }
  } catch (err) {
    console.error("GLM stream error:", err.message);
    // Roll back the user message so the conversation stays consistent
    await Message.findByIdAndDelete(userMessage._id);
    yield { type: "error", userMessageId: userMessage._id.toString() };
    return;
  }

  if (!fullText) {
    await Message.findByIdAndDelete(userMessage._id);
    yield { type: "error", userMessageId: userMessage._id.toString() };
    return;
  }

  const botMessage = await Message.create({
    conversationId,
    senderId: botId,
    text: fullText,
  });

  conv.latestmessage = fullText;
  await conv.save();

  yield { type: "done", message: botMessage };
};

const sendMessageHandler = async (data) => {
  const {
    text,
    imageUrl,
    senderId,
    conversationId,
    receiverId,
    isReceiverInsideChatRoom,
    replyTo,
  } = data;
  const conversation = await Conversation.findById(conversationId);
  
  if (!receiverId) {
    const message = await Message.create({
      conversationId,
      senderId,
      text,
      imageUrl,
      seenBy: [],
      ...(replyTo && { replyTo }),
    });

    conversation.latestmessage = text || "发送了一张图片";
    conversation.unreadCounts = conversation.unreadCounts.map((unread) => {
      if (unread.userId.toString() !== senderId) {
        return { ...unread, count: unread.count + 1 };
      }
      return unread;
    });
    await conversation.save();
    await message.populate('replyTo', 'text imageUrl senderId softDeleted');
    return message;
  }
  
  if (!isReceiverInsideChatRoom) {
    const message = await Message.create({
      conversationId,
      senderId,
      text,
      imageUrl,
      seenBy: [],
      ...(replyTo && { replyTo }),
    });

    conversation.latestmessage = text || "发送了一张图片";
    conversation.unreadCounts = conversation.unreadCounts.map((unread) => {
      if (unread.userId.toString() === receiverId.toString()) {
        return { ...unread, count: unread.count + 1 };
      }
      return unread;
    });
    await conversation.save();
    await message.populate('replyTo', 'text imageUrl senderId softDeleted');
    return message;
  } else {
    const message = await Message.create({
      conversationId,
      senderId,
      text,
      imageUrl,
      seenBy: [
        {
          user: receiverId,
          seenAt: new Date(),
        },
      ],
      ...(replyTo && { replyTo }),
    });
    conversation.latestmessage = text || "发送了一张图片";
    await conversation.save();
    await message.populate('replyTo', 'text imageUrl senderId softDeleted');
    return message;
  }
};

/**
 * Used by the socket handler for real-time delete.
 * scope="everyone" → soft-delete (sets softDeleted=true), only sender allowed.
 * scope="me"       → adds requesterId to hiddenFrom.
 * Returns the updated message or false on failure.
 */
const deleteMessageHandler = async ({ messageId, scope, requesterId }) => {
  try {
    const message = await Message.findById(messageId);
    if (!message) return false;

    if (scope === 'everyone') {
      if (message.senderId.toString() !== requesterId.toString()) return false;
      message.softDeleted = true;
    } else {
      const alreadyHidden = message.hiddenFrom.some(
        (id) => id.toString() === requesterId.toString()
      );
      if (!alreadyHidden) message.hiddenFrom.push(requesterId);
    }

    await message.save();
    return message;
  } catch (error) {
    console.log(error.message);
    return false;
  }
};

/**
 * DELETE /api/message/bulk
 * body: { messageIds: string[] }
 * Adds the requesting user to hiddenFrom for every listed message (hard-delete for self).
 */
const bulkHide = async (req, res) => {
  const { messageIds } = req.body;
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: 'messageIds must be a non-empty array' });
  }
  try {
    await Message.updateMany(
      { _id: { $in: messageIds }, hiddenFrom: { $ne: req.user.id } },
      { $push: { hiddenFrom: req.user.id } }
    );
    res.status(200).json({ message: 'Messages hidden' });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * POST /api/message/:id/star
 * Toggle star for the requesting user on a single message.
 * Returns { isStarred: boolean }.
 */
const toggleStar = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Ensure the requester is a member of the conversation
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const isMember = conversation.members.some((m) => m.toString() === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden' });

    const alreadyStarred = message.starredBy.some((id) => id.toString() === req.user.id);
    if (alreadyStarred) {
      message.starredBy = message.starredBy.filter((id) => id.toString() !== req.user.id);
    } else {
      message.starredBy.push(req.user.id);
    }
    await message.save();
    res.status(200).json({ isStarred: !alreadyStarred, starredBy: message.starredBy });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * GET /api/message/starred
 * Returns all messages starred by the requesting user, newest first.
 * Each message includes a populated conversationId so the client knows
 * which chat to navigate to.
 */
const getStarredMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      starredBy: req.user.id,
      hiddenFrom: { $ne: req.user.id },
      softDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .populate({
        path: 'conversationId',
        select: 'members',
        populate: {
          path: 'members',
          select: '-password',
        },
      })
      .lean();

    res.json(messages);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  allMessage,
  streamAiResponse,
  deleteMessage,
  bulkHide,
  clearChat,
  sendMessageHandler,
  deleteMessageHandler,
  toggleStar,
  getStarredMessages,
  translateMessage,
};
