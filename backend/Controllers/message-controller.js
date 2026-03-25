const {
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
} = require("../Services/message-service.js");

const getMessages = async (req, res) => {
  try {
    const result = await getAllMessages(req.params.id, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result.messages);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const deleteMessageController = async (req, res) => {
  try {
    const { messageId, scope } = req.params;
    const result = await deleteMessage(messageId, req.user.id, scope);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const clearChatController = async (req, res) => {
  try {
    const result = await clearChat(req.params.id, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const bulkHideMessagesController = async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: "messageIds must be a non-empty array" });
    }
    const result = await bulkHideMessages(messageIds, req.user.id);
    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const toggleStarController = async (req, res) => {
  try {
    const result = await toggleStar(req.params.id, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const getStarredMessagesController = async (req, res) => {
  try {
    const messages = await getStarredMessages(req.user.id);
    res.json(messages);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const translateController = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const translatedText = await translateText(text);
    res.json({ translatedText });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message || "翻译服务暂时不可用" });
  }
};

module.exports = {
  getMessages,
  deleteMessage: deleteMessageController,
  clearChat: clearChatController,
  bulkHideMessages: bulkHideMessagesController,
  toggleStar: toggleStarController,
  getStarredMessages: getStarredMessagesController,
  translate: translateController,
  streamAiResponse,
  sendMessage,
  deleteMessageHandler,
};
