const {
  createGroup,
  getGroupDetails,
  updateGroupInfo,
  addMembersToGroup,
  removeMemberFromGroup,
  leaveGroup,
  setGroupAdmin,
  transferGroupOwnership,
  summarizeUnreadMessages,
} = require("../Services/group-service.js");

const createGroupHandler = async (req, res) => {
  try {
    const { name, memberIds, description } = req.body;
    const ownerId = req.user.id;

    if (!name || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ error: "群组名称和成员不能为空" });
    }

    const group = await createGroup(name, memberIds, ownerId, description);
    return res.status(201).json(group);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "创建群组失败" });
  }
};

const getGroupDetailsHandler = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const result = await getGroupDetails(groupId, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(200).json(result.group);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "获取群组信息失败" });
  }
};

const updateGroupHandler = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, avatar } = req.body;
    const userId = req.user.id;

    const result = await updateGroupInfo(groupId, userId, { name, description, avatar });
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(200).json(result.group);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "更新群组信息失败" });
  }
};

const addMembersHandler = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user.id;

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ error: "请选择要添加的成员" });
    }

    const result = await addMembersToGroup(groupId, memberIds, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(200).json(result.group);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "添加成员失败" });
  }
};

const removeMemberHandler = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user.id;

    const result = await removeMemberFromGroup(groupId, memberId, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    if (result.dissolved) {
      return res.status(200).json({ message: result.message, dissolved: true });
    }

    res.status(200).json(result.group);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "移除成员失败" });
  }
};

const leaveGroupHandler = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const result = await leaveGroup(groupId, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    if (result.dissolved) {
      return res.status(200).json({ message: result.message, dissolved: true });
    }

    res.status(200).json({ message: result.message });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "退出群组失败" });
  }
};

const setAdminHandler = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { isAdmin } = req.body;
    const userId = req.user.id;

    const result = await setGroupAdmin(groupId, memberId, isAdmin, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(200).json(result.group);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "设置管理员失败" });
  }
};

const transferOwnershipHandler = async (req, res) => {
  try {
    const { groupId, newOwnerId } = req.params;
    const userId = req.user.id;

    const result = await transferGroupOwnership(groupId, newOwnerId, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.status(200).json(result.group);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "转让群组失败" });
  }
};

const summarizeUnreadHandler = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const result = await summarizeUnreadMessages(groupId, userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Summarize unread error:", error);
    res.status(500).json({ error: "生成总结失败，请稍后重试" });
  }
};

module.exports = {
  createGroup: createGroupHandler,
  getGroupDetails: getGroupDetailsHandler,
  updateGroup: updateGroupHandler,
  addMembers: addMembersHandler,
  removeMember: removeMemberHandler,
  leaveGroup: leaveGroupHandler,
  setAdmin: setAdminHandler,
  transferOwnership: transferOwnershipHandler,
  summarizeUnread: summarizeUnreadHandler,
};
