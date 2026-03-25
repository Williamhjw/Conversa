const Message = require("../Models/Message.js");
const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");
const { GLM_MODEL, GLM_API_KEY } = require("../secrets.js");

const findMessageById = async (id) => {
  return Message.findById(id);
};

const createMessage = async (messageData) => {
  return Message.create(messageData);
};

const deleteMessageById = async (id) => {
  return Message.findByIdAndDelete(id);
};

const updateMessage = async (id, updates) => {
  return Message.findByIdAndUpdate(id, updates, { new: true });
};

const findMessagesByConversation = async (conversationId, userId) => {
  return Message.find({
    conversationId,
    hiddenFrom: { $ne: userId },
  })
    .populate('replyTo', 'text imageUrl senderId softDeleted')
    .populate('senderId', 'name profilePic')
    .lean();
};

const markMessagesAsSeen = async (conversationId, userId) => {
  await Message.updateMany(
    {
      conversationId,
      hiddenFrom: { $ne: userId },
      "seenBy.user": { $ne: userId },
    },
    { $push: { seenBy: { user: userId, seenAt: new Date() } } }
  );
};

const sanitizeMessages = (messages) => {
  return messages.map((msg) => {
    if (!msg.softDeleted) return msg;
    return {
      ...msg,
      text: "此消息已删除",
      imageUrl: undefined,
    };
  });
};

const getAllMessages = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { error: "Conversation not found", status: 404 };
  }

  const isMember = conversation.members.some(
    (m) => m.toString() === userId
  );
  if (!isMember) {
    return { error: "Forbidden", status: 403 };
  }

  await markMessagesAsSeen(conversationId, userId);
  const messages = await findMessagesByConversation(conversationId, userId);
  return { messages: sanitizeMessages(messages) };
};

const deleteMessage = async (messageId, userId, scope) => {
  const message = await findMessageById(messageId);
  if (!message) {
    return { error: 'Message not found', status: 404 };
  }

  if (scope === 'everyone') {
    if (message.senderId.toString() !== userId) {
      return { error: 'Only the sender can delete for everyone', status: 403 };
    }
    message.softDeleted = true;
  } else {
    const alreadyHidden = message.hiddenFrom.some(
      (id) => id.toString() === userId
    );
    if (!alreadyHidden) message.hiddenFrom.push(userId);
  }

  await message.save();
  return { message };
};

const clearChat = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { error: 'Conversation not found', status: 404 };
  }

  const isMember = conversation.members.some(
    (m) => m.toString() === userId
  );
  if (!isMember) {
    return { error: 'Forbidden', status: 403 };
  }

  await Message.updateMany(
    {
      conversationId,
      hiddenFrom: { $ne: userId },
    },
    { $push: { hiddenFrom: userId } }
  );

  return { message: 'Chat cleared' };
};

const bulkHideMessages = async (messageIds, userId) => {
  await Message.updateMany(
    { _id: { $in: messageIds }, hiddenFrom: { $ne: userId } },
    { $push: { hiddenFrom: userId } }
  );
  return { message: 'Messages hidden' };
};

const toggleStar = async (messageId, userId) => {
  const message = await findMessageById(messageId);
  if (!message) {
    return { error: 'Message not found', status: 404 };
  }

  const conversation = await Conversation.findById(message.conversationId);
  if (!conversation) {
    return { error: 'Conversation not found', status: 404 };
  }

  const isMember = conversation.members.some((m) => m.toString() === userId);
  if (!isMember) {
    return { error: 'Forbidden', status: 403 };
  }

  const alreadyStarred = message.starredBy.some((id) => id.toString() === userId);
  if (alreadyStarred) {
    message.starredBy = message.starredBy.filter((id) => id.toString() !== userId);
  } else {
    message.starredBy.push(userId);
  }
  await message.save();
  return { isStarred: !alreadyStarred, starredBy: message.starredBy };
};

const getStarredMessages = async (userId) => {
  return Message.find({
    starredBy: userId,
    hiddenFrom: { $ne: userId },
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
};

const translateText = async (text) => {
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
    throw new Error('翻译服务暂时不可用');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || text;
};

const streamAiResponse = async function* (text, senderId, conversationId) {
  const conv = await Conversation.findById(conversationId);
  const botMember = await User.findOne({
    _id: { $in: conv.members },
    isBot: true,
  });
  if (!botMember) { yield { type: "error" }; return; }
  const botId = botMember._id;

  const userMessage = await createMessage({
    conversationId,
    senderId,
    text,
    seenBy: [{ user: botId, seenAt: new Date() }],
  });
  yield { type: "user-message", message: userMessage };

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
      await deleteMessageById(userMessage._id);
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
            // Ignore parse errors
          }
        }
      }
    }
  } catch (err) {
    console.error("GLM stream error:", err.message);
    await deleteMessageById(userMessage._id);
    yield { type: "error", userMessageId: userMessage._id.toString() };
    return;
  }

  if (!fullText) {
    await deleteMessageById(userMessage._id);
    yield { type: "error", userMessageId: userMessage._id.toString() };
    return;
  }

  const botMessage = await createMessage({
    conversationId,
    senderId: botId,
    text: fullText,
  });

  conv.latestmessage = fullText;
  await conv.save();

  yield { type: "done", message: botMessage };
};

const sendMessage = async (data) => {
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
    const message = await createMessage({
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
    const message = await createMessage({
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
    const message = await createMessage({
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

const deleteMessageHandler = async ({ messageId, scope, requesterId }) => {
  try {
    const message = await findMessageById(messageId);
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

module.exports = {
  findMessageById,
  createMessage,
  deleteMessageById,
  updateMessage,
  findMessagesByConversation,
  markMessagesAsSeen,
  sanitizeMessages,
  getAllMessages,
  deleteMessage,
  clearChat,
  bulkHideMessages,
  toggleStar,
  getStarredMessages,
  translateText,
  streamAiResponse,
  sendMessage,
  deleteMessageHandler,
};
