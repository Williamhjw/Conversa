const { GoogleGenerativeAI } = require("@google/generative-ai");
const Message = require("../Models/Message.js");
const Conversation = require("../Models/Conversation.js");
const {
  GEMINI_MODEL,
  GEMINI_API_KEY,
} = require("../secrets.js");

const configuration = new GoogleGenerativeAI(GEMINI_API_KEY);
const modelId = GEMINI_MODEL;
const model = configuration.getGenerativeModel({ model: modelId });

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
        deletedFrom: { $ne: req.user.id },
        "seenBy.user": { $ne: req.user.id },
      },
      { $push: { seenBy: { user: req.user.id, seenAt: new Date() } } }
    );

    const messages = await Message.find({
      conversationId: req.params.id,
      deletedFrom: { $ne: req.user.id },
    });

    res.json(messages);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const deletemesage = async (req, res) => {
  const msgid = req.body.messageid;
  const userids = req.body.userids;
  try {
    const message = await Message.findById(msgid);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    for (const userid of userids) {
      const alreadyDeleted = message.deletedFrom.some(
        (id) => id.toString() === userid.toString()
      );
      if (!alreadyDeleted) {
        message.deletedFrom.push(userid);
      }
    }
    await message.save();
    res.status(200).send("Message deleted successfully");
  } catch (error) {
    console.log(error.message);
    res.status(500).send({ error: "Internal Server Error" });
  }
};

const getAiResponse = async (prompt, senderId, conversationId) => {
  var currentMessages = [];
  const conv = await Conversation.findById(conversationId);
  const botId = conv.members.find((member) => member != senderId);

  const messagelist = await Message.find({
    conversationId: conversationId,
  })
    .sort({ createdAt: -1 })
    .limit(20);

  messagelist.forEach((message) => {
    if (message.senderId == senderId) {
      currentMessages.push({
        role: "user",
        parts: message.text,
      });
    } else {
      currentMessages.push({
        role: "model",
        parts: message.text,
      });
    }
  });

  // reverse currentMessages
  currentMessages = currentMessages.reverse();

  try {
    const chat = model.startChat({
      history: currentMessages,
      generationConfig: {
        maxOutputTokens: 2000,
      },
    });

    const result = await chat.sendMessage(prompt);
    const response = result.response;
    var responseText = response.text();

    if (responseText.length < 1) {
      return null;
    }

    await Message.create({
      conversationId: conversationId,
      senderId: senderId,
      text: prompt,
      seenBy: [{ user: botId, seenAt: new Date() }],
    });

    const botMessage = await Message.create({
      conversationId: conversationId,
      senderId: botId,
      text: responseText,
    });

    conv.latestmessage = responseText;
    await conv.save();

    return botMessage;
  } catch (error) {
    console.error("AI response error:", error.message);
    return null; // use null consistently
  }
};

const sendMessageHandler = async (data) => {
  const {
    text,
    imageUrl,
    senderId,
    conversationId,
    receiverId,
    isReceiverInsideChatRoom,
  } = data;
  const conversation = await Conversation.findById(conversationId);
  if (!isReceiverInsideChatRoom) {
    const message = await Message.create({
      conversationId,
      senderId,
      text,
      imageUrl,
      seenBy: [],
    });

    // update conversation latest message and increment unread count of receiver by 1
    conversation.latestmessage = text || "[image]";
    conversation.unreadCounts.map((unread) => {
      if (unread.userId.toString() == receiverId.toString()) {
        unread.count += 1;
      }
    });
    await conversation.save();
    return message;
  } else {
    // create new message with seenby receiver
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
    });
    conversation.latestmessage = text || "[image]";
    await conversation.save();
    return message;
  }
};

const deleteMessageHandler = async (data) => {
  const { messageId, deleteFrom } = data;
  const message = await Message.findById(messageId);

  if (!message) {
    return false;
  }

  try {
    for (const userId of deleteFrom) {
      const alreadyDeleted = message.deletedFrom.some(
        (id) => id.toString() === userId.toString()
      );
      if (!alreadyDeleted) {
        message.deletedFrom.push(userId);
      }
    }
    await message.save();

    return true;
  } catch (error) {
    console.log(error.message);
    return false;
  }
};

module.exports = {
  allMessage,
  getAiResponse,
  deletemesage,
  sendMessageHandler,
  deleteMessageHandler,
};
