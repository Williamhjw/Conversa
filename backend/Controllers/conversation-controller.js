const {
  getOrCreateConversation,
  getConversation,
  getConversationList,
  togglePin,
  deleteConversation,
} = require("../Services/conversation-service.js");

const getConversationHandler = async (req, res) => {
  try {
    const { members } = req.body;
    const userId = req.user.id;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: "Members array is required" });
    }

    const allMembers = [...new Set([...members, userId])];
    const result = await getOrCreateConversation(allMembers, userId);
    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const getConversationById = async (req, res) => {
  try {
    const result = await getConversation(req.params.id, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result.conversation);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const getConversations = async (req, res) => {
  try {
    const result = await getConversationList(req.user.id);
    res.json(result.conversations);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const togglePinHandler = async (req, res) => {
  try {
    const result = await togglePin(req.user.id, req.params.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const deleteConversationHandler = async (req, res) => {
  try {
    const result = await deleteConversation(req.user.id, req.params.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

module.exports = {
  getConversation: getConversationHandler,
  getConversationById,
  getConversations,
  togglePin: togglePinHandler,
  deleteConversation: deleteConversationHandler,
};
