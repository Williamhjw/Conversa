const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");

/**
 * Sanitizes a populated member document when viewed by someone whom that
 * member has blocked. Profile fields become generic placeholders; only the
 * _id and email remain untouched (per product spec).
 * The `blockedUsers` array is always stripped from the output.
 */
function sanitizeForRequester(member, requesterId) {
  const obj = member.toObject ? member.toObject() : { ...member };
  const isBlocked = obj.blockedUsers?.some(
    (id) => id.toString() === requesterId.toString()
  );
  delete obj.blockedUsers; // never expose blockedUsers list to clients

  if (!isBlocked) return obj;

  return {
    _id: obj._id,
    email: obj.email, // email is intentionally NOT sanitized
    name: "Conversa User",
    about: "",
    profilePic: "https://ui-avatars.com/api/?name=Conversa+User&background=6366f1&color=fff&bold=true",
    isOnline: false,
    lastSeen: null,
    isBot: obj.isBot,
    createdAt: null,
    updatedAt: null,
  };
}

const createConversation = async (req, res) => {
  try {
    const { members: memberIds } = req.body;

    if (!memberIds) {
      return res.status(400).json({
        error: "Please fill all the fields",
      });
    }

    const conv = await Conversation.findOne({
      members: { $all: memberIds, $size: memberIds.length },
    }).populate("members", "-password");

    if (conv) {
      const sanitizedConv = conv.toObject();
      sanitizedConv.members = conv.members
        .filter((member) => member._id.toString() !== req.user.id)
        .map((member) => sanitizeForRequester(member, req.user.id));
      return res.status(200).json(sanitizedConv);
    }

    const newConversation = await Conversation.create({
      members: memberIds,
      unreadCounts: memberIds.map((memberId) => ({
        userId: memberId,
        count: 0,
      })),
    });

    await newConversation.populate("members", "-password");

    const sanitizedNew = newConversation.toObject();
    sanitizedNew.members = newConversation.members
      .filter((member) => member._id.toString() !== req.user.id)
      .map((member) => sanitizeForRequester(member, req.user.id));

    return res.status(200).json(sanitizedNew);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).populate(
      "members",
      "-password",
    );

    if (!conversation) {
      return res.status(404).json({
        error: "No conversation found",
      });
    }

    // Ensure the requesting user is a member
    const isMember = conversation.members.some(
      (m) => m._id.toString() === req.user.id
    );
    if (!isMember) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const sanitized = conversation.toObject();
    sanitized.members = conversation.members.map((m) =>
      sanitizeForRequester(m, req.user.id)
    );
    res.status(200).json(sanitized);
  } catch (error) {
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const getConversationList = async (req, res) => {
  const userId = req.user.id;

  try {
    const currentUser = await User.findById(userId).select("pinnedConversations");
    const pinnedSet = new Set((currentUser.pinnedConversations || []).map((id) => id.toString()));

    const conversationList = await Conversation.find({
      members: { $in: userId },
    })
      .populate("members", "-password")
      .sort({ updatedAt: -1 });

    if (!conversationList) {
      return res.status(404).json({ error: "No conversation found" });
    }

    let result = [];
    for (let i = 0; i < conversationList.length; i++) {
      const convId = conversationList[i]._id.toString();

      const conv = conversationList[i].toObject();
      
      if (conv.isGroup) {
        conv.members = conversationList[i].members.map((member) =>
          sanitizeForRequester(member, userId)
        );
      } else {
        conv.members = conversationList[i].members
          .filter((member) => member.id !== userId)
          .map((member) => sanitizeForRequester(member, userId));
      }
      conv.isPinned = pinnedSet.has(convId);
      result.push(conv);
    }

    // Sort: pinned first, then by updatedAt (already sorted by mongo)
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

    res.status(200).json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const togglePin = async (req, res) => {
  const userId = req.user.id;
  const convId = req.params.id;

  try {
    const conversation = await Conversation.findById(convId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const isMember = conversation.members.some((m) => m.toString() === userId);
    if (!isMember) return res.status(403).json({ error: "Forbidden" });

    const user = await User.findById(userId).select("pinnedConversations");
    const isPinned = user.pinnedConversations.some((id) => id.toString() === convId);

    if (isPinned) {
      await User.findByIdAndUpdate(userId, { $pull: { pinnedConversations: convId } });
      return res.status(200).json({ isPinned: false });
    } else {
      await User.findByIdAndUpdate(userId, { $addToSet: { pinnedConversations: convId } });
      return res.status(200).json({ isPinned: true });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const deleteConversation = async (req, res) => {
  const userId = req.user.id;
  const convId = req.params.id;

  try {
    const conversation = await Conversation.findById(convId);
    if (!conversation) {
      return res.status(404).json({ error: "对话不存在" });
    }

    const isMember = conversation.members.some((m) => m.toString() === userId);
    if (!isMember) {
      return res.status(403).json({ error: "无权删除此对话" });
    }

    await User.findByIdAndUpdate(userId, { $pull: { pinnedConversations: convId } });

    if (conversation.isGroup) {
      conversation.members = conversation.members.filter((m) => m.toString() !== userId);
      conversation.unreadCounts = conversation.unreadCounts.filter(
        (uc) => uc.userId.toString() !== userId
      );
      conversation.groupAdmins = conversation.groupAdmins.filter(
        (admin) => admin.toString() !== userId
      );

      if (conversation.groupOwner && conversation.groupOwner.toString() === userId) {
        if (conversation.members.length > 0) {
          const newOwner = conversation.members[0];
          conversation.groupOwner = newOwner;
          if (!conversation.groupAdmins.some((a) => a.toString() === newOwner.toString())) {
            conversation.groupAdmins.push(newOwner);
          }
        }
      }

      if (conversation.members.length === 0) {
        await Conversation.findByIdAndDelete(convId);
      } else {
        await conversation.save();
      }
    } else {
      await Conversation.findByIdAndDelete(convId);
    }

    res.status(200).json({ message: "对话已删除", deleted: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

module.exports = {
  createConversation,
  getConversation,
  getConversationList,
  togglePin,
  deleteConversation,
};
