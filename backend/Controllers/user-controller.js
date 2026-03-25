const {
  getOnlineStatus,
  blockUser,
  unblockUser,
  getBlockStatus,
  getNonFriendsList,
  updateProfile,
  updateAvatar,
  deleteAccount,
  checkDuplicateUsers,
} = require("../Services/user-service.js");

const getOnlineStatusHandler = async (req, res) => {
  const userId = req.params.id;
  const requesterId = req.user.id;
  try {
    const result = await getOnlineStatus(userId, requesterId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(200).json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const blockUserHandler = async (req, res) => {
  const targetId = req.params.id;
  const myId = req.user.id;
  try {
    const result = await blockUser(myId, targetId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const unblockUserHandler = async (req, res) => {
  const targetId = req.params.id;
  const myId = req.user.id;
  try {
    const result = await unblockUser(myId, targetId);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getBlockStatusHandler = async (req, res) => {
  const targetId = req.params.id;
  const myId = req.user.id;
  try {
    const result = await getBlockStatus(myId, targetId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getNonFriendsListHandler = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const sort = req.query.sort || "name_asc";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

    const result = await getNonFriendsList(req.user.id, { search, sort, page, limit });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateprofile = async (req, res) => {
  try {
    const result = await updateProfile(req.user.id, req.body);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "没有上传文件" });
    }

    const result = await updateAvatar(req.user.id, req.file, req.protocol, req.get("host"));
    res.json(result);
  } catch (error) {
    console.error("Avatar upload error:", error);
    res.status(500).json({ error: "头像上传失败" });
  }
};

const deleteAccountHandler = async (req, res) => {
  try {
    const result = await deleteAccount(req.user.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const checkDuplicateUsersHandler = async (req, res) => {
  try {
    const result = await checkDuplicateUsers();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getOnlineStatus: getOnlineStatusHandler,
  getNonFriendsList: getNonFriendsListHandler,
  updateprofile,
  uploadAvatar,
  blockUser: blockUserHandler,
  unblockUser: unblockUserHandler,
  getBlockStatus: getBlockStatusHandler,
  deleteAccount: deleteAccountHandler,
  checkDuplicateUsers: checkDuplicateUsersHandler,
};
