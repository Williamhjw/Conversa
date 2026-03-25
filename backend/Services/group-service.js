const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");
const Message = require("../Models/Message.js");
const { GLM_MODEL, GLM_API_KEY } = require("../secrets.js");

const sanitizeForMember = (member, requesterId) => {
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

const sanitizeGroup = (group, userId) => {
  const sanitizedGroup = group.toObject ? group.toObject() : { ...group };
  sanitizedGroup.members = group.members.map((m) => sanitizeForMember(m, userId));
  return sanitizedGroup;
};

const createGroup = async (name, memberIds, ownerId, description) => {
  const allMembers = [...new Set([ownerId, ...memberIds])];
  const groupAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&bold=true&size=128`;

  const newGroup = await Conversation.create({
    members: allMembers,
    isGroup: true,
    groupName: name,
    groupAvatar,
    groupDescription: description || "",
    groupOwner: ownerId,
    groupAdmins: [ownerId],
    unreadCounts: allMembers.map((memberId) => ({
      userId: memberId,
      count: 0,
    })),
  });

  await newGroup.populate("members", "-password");
  await newGroup.populate("groupOwner", "-password");
  await newGroup.populate("groupAdmins", "-password");

  return sanitizeGroup(newGroup, ownerId);
};

const findGroupById = async (groupId) => {
  return Conversation.findById(groupId);
};

const getGroupDetails = async (groupId, userId) => {
  const group = await Conversation.findById(groupId)
    .populate("members", "-password")
    .populate("groupOwner", "-password")
    .populate("groupAdmins", "-password");

  if (!group || !group.isGroup) {
    return { error: "群组不存在", status: 404 };
  }

  const isMember = group.members.some((m) => m._id.toString() === userId);
  if (!isMember) {
    return { error: "你不是群组成员", status: 403 };
  }

  return { group: sanitizeGroup(group, userId) };
};

const updateGroupInfo = async (groupId, userId, updates) => {
  const group = await Conversation.findById(groupId);
  if (!group || !group.isGroup) {
    return { error: "群组不存在", status: 404 };
  }

  const isOwner = group.groupOwner?.toString() === userId;
  const isAdmin = group.groupAdmins.some((admin) => admin.toString() === userId);

  if (!isOwner && !isAdmin) {
    return { error: "只有群主或管理员可以修改群组信息", status: 403 };
  }

  if (updates.name) group.groupName = updates.name;
  if (updates.description !== undefined) group.groupDescription = updates.description;
  if (updates.avatar) group.groupAvatar = updates.avatar;

  await group.save();
  await group.populate("members", "-password");
  await group.populate("groupOwner", "-password");
  await group.populate("groupAdmins", "-password");

  return { group: sanitizeGroup(group, userId) };
};

const addMembersToGroup = async (groupId, memberIds, userId) => {
  const group = await Conversation.findById(groupId);
  if (!group || !group.isGroup) {
    return { error: "群组不存在", status: 404 };
  }

  const isOwner = group.groupOwner?.toString() === userId;
  const isAdmin = group.groupAdmins.some((admin) => admin.toString() === userId);

  if (!isOwner && !isAdmin) {
    return { error: "只有群主或管理员可以添加成员", status: 403 };
  }

  const existingMemberIds = group.members.map((m) => m.toString());
  const newMembers = memberIds.filter((id) => !existingMemberIds.includes(id));

  if (newMembers.length === 0) {
    return { error: "所选用户已在群组中", status: 400 };
  }

  group.members = [...group.members, ...newMembers];
  newMembers.forEach((memberId) => {
    group.unreadCounts.push({ userId: memberId, count: 0 });
  });

  await group.save();
  await group.populate("members", "-password");
  await group.populate("groupOwner", "-password");
  await group.populate("groupAdmins", "-password");

  return { group: sanitizeGroup(group, userId) };
};

const removeMemberFromGroup = async (groupId, memberId, userId) => {
  const group = await Conversation.findById(groupId);
  if (!group || !group.isGroup) {
    return { error: "群组不存在", status: 404 };
  }

  const isOwner = group.groupOwner?.toString() === userId;
  const isAdmin = group.groupAdmins.some((admin) => admin.toString() === userId);
  const isSelf = memberId === userId;

  if (!isOwner && !isAdmin && !isSelf) {
    return { error: "没有权限移除该成员", status: 403 };
  }

  if (group.groupOwner?.toString() === memberId) {
    return { error: "不能移除群主", status: 400 };
  }

  group.members = group.members.filter((m) => m.toString() !== memberId);
  group.groupAdmins = group.groupAdmins.filter((admin) => admin.toString() !== memberId);
  group.unreadCounts = group.unreadCounts.filter((uc) => uc.userId.toString() !== memberId);

  if (group.members.length === 0) {
    await Conversation.findByIdAndDelete(groupId);
    return { dissolved: true, message: "群组已解散" };
  }

  await group.save();
  await group.populate("members", "-password");
  await group.populate("groupOwner", "-password");
  await group.populate("groupAdmins", "-password");

  return { group: sanitizeGroup(group, userId) };
};

const leaveGroup = async (groupId, userId) => {
  const group = await Conversation.findById(groupId);
  if (!group || !group.isGroup) {
    return { error: "群组不存在", status: 404 };
  }

  const isMember = group.members.some((m) => m.toString() === userId);
  if (!isMember) {
    return { error: "你不是群组成员", status: 400 };
  }

  if (group.groupOwner?.toString() === userId) {
    if (group.members.length === 1) {
      await Conversation.findByIdAndDelete(groupId);
      return { dissolved: true, message: "群组已解散" };
    }

    const newOwner = group.members.find((m) => m.toString() !== userId);
    if (newOwner) {
      group.groupOwner = newOwner;
      if (!group.groupAdmins.some((a) => a.toString() === newOwner.toString())) {
        group.groupAdmins.push(newOwner);
      }
    }
  }

  group.members = group.members.filter((m) => m.toString() !== userId);
  group.groupAdmins = group.groupAdmins.filter((admin) => admin.toString() !== userId);
  group.unreadCounts = group.unreadCounts.filter((uc) => uc.userId.toString() !== userId);

  await group.save();
  return { message: "已退出群组" };
};

const setGroupAdmin = async (groupId, memberId, isAdmin, userId) => {
  const group = await Conversation.findById(groupId);
  if (!group || !group.isGroup) {
    return { error: "群组不存在", status: 404 };
  }

  if (group.groupOwner?.toString() !== userId) {
    return { error: "只有群主可以设置管理员", status: 403 };
  }

  const isMember = group.members.some((m) => m.toString() === memberId);
  if (!isMember) {
    return { error: "该用户不是群组成员", status: 400 };
  }

  if (isAdmin) {
    if (!group.groupAdmins.some((a) => a.toString() === memberId)) {
      group.groupAdmins.push(memberId);
    }
  } else {
    group.groupAdmins = group.groupAdmins.filter((admin) => admin.toString() !== memberId);
  }

  await group.save();
  await group.populate("members", "-password");
  await group.populate("groupOwner", "-password");
  await group.populate("groupAdmins", "-password");

  return { group: sanitizeGroup(group, userId) };
};

const transferGroupOwnership = async (groupId, newOwnerId, userId) => {
  const group = await Conversation.findById(groupId);
  if (!group || !group.isGroup) {
    return { error: "群组不存在", status: 404 };
  }

  if (group.groupOwner?.toString() !== userId) {
    return { error: "只有群主可以转让群组", status: 403 };
  }

  const isMember = group.members.some((m) => m.toString() === newOwnerId);
  if (!isMember) {
    return { error: "该用户不是群组成员", status: 400 };
  }

  group.groupOwner = newOwnerId;
  if (!group.groupAdmins.some((a) => a.toString() === newOwnerId)) {
    group.groupAdmins.push(newOwnerId);
  }

  await group.save();
  await group.populate("members", "-password");
  await group.populate("groupOwner", "-password");
  await group.populate("groupAdmins", "-password");

  return { group: sanitizeGroup(group, userId) };
};

const getUnreadMessages = async (groupId, userId) => {
  const group = await Conversation.findById(groupId).populate("members", "-password");
  if (!group || !group.isGroup) {
    return { error: "群组不存在", status: 404 };
  }

  const isMember = group.members.some((m) => m._id.toString() === userId);
  if (!isMember) {
    return { error: "你不是群组成员", status: 403 };
  }

  const unreadEntry = group.unreadCounts.find((uc) => uc.userId.toString() === userId);
  const unreadCount = unreadEntry?.count || 0;

  if (unreadCount === 0) {
    return { summary: "暂无未读消息", unreadCount: 0, hasUnread: false };
  }

  const lastSeenMessage = await Message.findOne({
    conversationId: groupId,
    seenBy: { $elemMatch: { user: userId } },
  }).sort({ createdAt: -1 });

  const query = {
    conversationId: groupId,
    hiddenFrom: { $ne: userId },
    softDeleted: { $ne: true },
  };

  if (lastSeenMessage) {
    query.createdAt = { $gt: lastSeenMessage.createdAt };
  }

  const unreadMessages = await Message.find(query)
    .sort({ createdAt: 1 })
    .populate("senderId", "name")
    .limit(50);

  if (unreadMessages.length === 0) {
    return { summary: "暂无未读消息", unreadCount: 0, hasUnread: false };
  }

  return { unreadMessages, unreadCount: unreadMessages.length, hasUnread: true };
};

const buildMessagesText = (messages) => {
  return messages.map((msg) => {
    const senderName = msg.senderId?.name || "未知用户";
    const content = msg.text || "[图片]";
    const time = new Date(msg.createdAt).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `[${time}] ${senderName}: ${content}`;
  }).join("\n");
};

const summarizeMessages = async (messagesText, messageCount) => {
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
          content: `你是一个群聊消息总结助手。请根据用户提供的群聊消息，生成一个简洁的中文总结。

总结要求：
1. 概括主要讨论话题（1-2句话）
2. 列出关键信息或决定（如有）
3. 提及重要发言者及其观点
4. 保持简洁，总字数控制在200字以内
5. 如果消息较少或内容简单，可以更简短
6. 使用自然的中文表达，不要使用markdown格式

输出格式示例：
本次群聊主要讨论了[话题]。其中[用户名]提到[关键信息]，[用户名]建议[某决定]。`,
        },
        {
          role: "user",
          content: `请总结以下群聊未读消息（共${messageCount}条）：\n\n${messagesText}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Summarization API error:", errorText);
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "无法生成总结";
};

const summarizeUnreadMessages = async (groupId, userId) => {
  const result = await getUnreadMessages(groupId, userId);
  if (result.error) return result;
  if (!result.hasUnread) return result;

  const messagesText = buildMessagesText(result.unreadMessages);
  const summary = await summarizeMessages(messagesText, result.unreadCount);

  if (!summary) {
    return { error: "AI 总结服务暂时不可用", status: 500 };
  }

  return { summary, unreadCount: result.unreadCount, hasUnread: true };
};

module.exports = {
  sanitizeForMember,
  sanitizeGroup,
  createGroup,
  findGroupById,
  getGroupDetails,
  updateGroupInfo,
  addMembersToGroup,
  removeMemberFromGroup,
  leaveGroup,
  setGroupAdmin,
  transferGroupOwnership,
  getUnreadMessages,
  summarizeUnreadMessages,
};
