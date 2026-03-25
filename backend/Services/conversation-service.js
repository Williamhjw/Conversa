const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");

const findConversationById = async (id) => {
  return Conversation.findById(id);
};

const findConversationByMembers = async (memberIds) => {
  return Conversation.findOne({
    members: { $all: memberIds, $size: memberIds.length },
  }).populate("members", "-password");
};

const createConversation = async (memberIds) => {
  return Conversation.create({
    members: memberIds,
    unreadCounts: memberIds.map((memberId) => ({
      userId: memberId,
      count: 0,
    })),
  });
};

const findConversationsByUser = async (userId) => {
  return Conversation.find({
    members: { $in: userId },
  })
    .populate("members", "-password")
    .sort({ updatedAt: -1 });
};

const sanitizeForRequester = (member, requesterId) => {
  const obj = member.toObject ? member.toObject() : { ...member };
  const isBlocked = obj.blockedUsers?.some(
    (id) => id.toString() === requesterId.toString()
  );
  delete obj.blockedUsers;

  if (!isBlocked) return obj;

  return {
    _id: obj._id,
    email: obj.email,
    name: "Conversa User",
    about: "",
    profilePic: "https://ui-avatars.com/api/?name=Conversa+User&background=6366f1&color=fff&bold=true",
    isOnline: false,
    lastSeen: null,
    isBot: obj.isBot,
    createdAt: null,
    updatedAt: null,
  };
};

const sanitizeConversationMembers = (conversation, userId, filterSelf = false) => {
  const conv = conversation.toObject ? conversation.toObject() : { ...conversation };
  
  if (conv.isGroup) {
    conv.members = conversation.members.map((member) =>
      sanitizeForRequester(member, userId)
    );
  } else {
    conv.members = conversation.members
      .filter((member) => filterSelf ? member._id.toString() !== userId : true)
      .map((member) => sanitizeForRequester(member, userId));
  }
  
  return conv;
};

const getOrCreateConversation = async (memberIds, userId) => {
  let conv = await findConversationByMembers(memberIds);

  if (conv) {
    return { conversation: sanitizeConversationMembers(conv, userId, true), isNew: false };
  }

  const newConversation = await createConversation(memberIds);
  await newConversation.populate("members", "-password");
  return { conversation: sanitizeConversationMembers(newConversation, userId, true), isNew: true };
};

const getConversation = async (conversationId, userId) => {
  const conversation = await findConversationById(conversationId).then(c => 
    c ? c.populate("members", "-password") : null
  );

  if (!conversation) {
    return { error: "No conversation found", status: 404 };
  }

  const isMember = conversation.members.some(
    (m) => m._id.toString() === userId
  );
  if (!isMember) {
    return { error: "Forbidden", status: 403 };
  }

  return { conversation: sanitizeConversationMembers(conversation, userId) };
};

const getConversationList = async (userId) => {
  const currentUser = await User.findById(userId).select("pinnedConversations");
  const pinnedSet = new Set((currentUser.pinnedConversations || []).map((id) => id.toString()));

  const conversationList = await findConversationsByUser(userId);

  if (!conversationList || conversationList.length === 0) {
    return { conversations: [] };
  }

  let result = [];
  for (let i = 0; i < conversationList.length; i++) {
    const convId = conversationList[i]._id.toString();
    const conv = sanitizeConversationMembers(conversationList[i], userId, !conversationList[i].isGroup);
    conv.isPinned = pinnedSet.has(convId);
    result.push(conv);
  }

  result.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  return { conversations: result };
};

const togglePin = async (userId, conversationId) => {
  const conversation = await findConversationById(conversationId);
  if (!conversation) {
    return { error: "Conversation not found", status: 404 };
  }

  const isMember = conversation.members.some((m) => m.toString() === userId);
  if (!isMember) {
    return { error: "Forbidden", status: 403 };
  }

  const user = await User.findById(userId).select("pinnedConversations");
  const isPinned = user.pinnedConversations.some((id) => id.toString() === conversationId);

  if (isPinned) {
    await User.findByIdAndUpdate(userId, { $pull: { pinnedConversations: conversationId } });
    return { isPinned: false };
  } else {
    await User.findByIdAndUpdate(userId, { $addToSet: { pinnedConversations: conversationId } });
    return { isPinned: true };
  }
};

const deleteConversation = async (userId, conversationId) => {
  const conversation = await findConversationById(conversationId);
  if (!conversation) {
    return { error: "对话不存在", status: 404 };
  }

  const isMember = conversation.members.some((m) => m.toString() === userId);
  if (!isMember) {
    return { error: "无权删除此对话", status: 403 };
  }

  await User.findByIdAndUpdate(userId, { $pull: { pinnedConversations: conversationId } });

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
      await Conversation.findByIdAndDelete(conversationId);
    } else {
      await conversation.save();
    }
  } else {
    await Conversation.findByIdAndDelete(conversationId);
  }

  return { message: "对话已删除", deleted: true };
};

module.exports = {
  findConversationById,
  findConversationByMembers,
  createConversation,
  findConversationsByUser,
  sanitizeForRequester,
  sanitizeConversationMembers,
  getOrCreateConversation,
  getConversation,
  getConversationList,
  togglePin,
  deleteConversation,
};
