const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../Models/User.js");

const PINNED_EMAIL = "pmsoni2016@gmail.com";

const findUserById = async (id) => {
  return User.findById(id);
};

const findUserByIdSelect = async (id, select) => {
  return User.findById(id).select(select);
};

const updateUserById = async (id, updates) => {
  return User.findByIdAndUpdate(id, updates, { new: true });
};

const getOnlineStatus = async (userId, requesterId) => {
  const user = await findUserById(userId);
  if (!user) {
    return { error: "User not found", status: 404 };
  }
  const isBlocked = user.blockedUsers?.some(
    (id) => id.toString() === requesterId
  );
  return { isOnline: isBlocked ? false : user.isOnline };
};

const blockUser = async (userId, targetId) => {
  if (userId === targetId) {
    return { error: "Cannot block yourself", status: 400 };
  }
  await updateUserById(userId, {
    $addToSet: { blockedUsers: targetId },
  });
  return { message: "User blocked" };
};

const unblockUser = async (userId, targetId) => {
  await updateUserById(userId, {
    $pull: { blockedUsers: targetId },
  });
  return { message: "User unblocked" };
};

const getBlockStatus = async (userId, targetId) => {
  const [me, them] = await Promise.all([
    findUserByIdSelect(userId, "blockedUsers"),
    findUserByIdSelect(targetId, "blockedUsers"),
  ]);
  if (!them) {
    return { error: "User not found", status: 404 };
  }
  const iBlockedThem = me.blockedUsers.some(
    (id) => id.toString() === targetId
  );
  const theyBlockedMe = them.blockedUsers.some(
    (id) => id.toString() === userId
  );
  return { iBlockedThem, theyBlockedMe };
};

const getNonFriendsList = async (userId, options) => {
  const { search, sort, page, limit } = options;
  const skip = (page - 1) * limit;

  const excludedIds = [userId];

  const baseFilter = {
    _id: { $nin: excludedIds },
    email: { $not: /bot$/ },
    isDeleted: { $ne: true },
  };

  if (search) {
    baseFilter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const sortMap = {
    name_asc: { name: 1 },
    name_desc: { name: -1 },
    last_seen_recent: { lastSeen: -1 },
    last_seen_oldest: { lastSeen: 1 },
  };
  const mongoSort = sortMap[sort] || sortMap.name_asc;

  let pinnedUser = null;
  if (!search) {
    pinnedUser = await User.findOne({
      ...baseFilter,
      email: PINNED_EMAIL,
    }).select("-password");
  }

  const mainFilter = pinnedUser
    ? { ...baseFilter, _id: { $nin: [...excludedIds, pinnedUser._id] } }
    : baseFilter;

  const effectiveLimit = (pinnedUser && page === 1) ? limit - 1 : limit;
  const effectiveSkip = (pinnedUser && page > 1) ? skip - 1 : skip;

  const [users, total] = await Promise.all([
    User.find(mainFilter).sort(mongoSort).skip(Math.max(0, effectiveSkip)).limit(effectiveLimit).select("-password"),
    User.countDocuments(mainFilter),
  ]);

  const grandTotal = total + (pinnedUser ? 1 : 0);
  const hasMore = skip + limit < grandTotal;

  return {
    users,
    pinnedUser: page === 1 ? pinnedUser : null,
    hasMore,
    total: grandTotal,
    page,
  };
};

const updateProfile = async (userId, updates) => {
  const dbuser = await findUserById(userId);
  const allowedUpdates = {
    name: updates.name,
    about: updates.about,
    profilePic: updates.profilePic,
    emailNotificationsEnabled: updates.emailNotificationsEnabled,
  };

  if (updates.newpassword) {
    const passwordCompare = await bcrypt.compare(
      updates.oldpassword,
      dbuser.password
    );
    if (!passwordCompare) {
      return { error: "Invalid Credentials", status: 400 };
    }

    const salt = await bcrypt.genSalt(10);
    const secPass = await bcrypt.hash(updates.newpassword, salt);
    allowedUpdates.password = secPass;
  }

  Object.keys(allowedUpdates).forEach(
    (key) => allowedUpdates[key] === undefined && delete allowedUpdates[key]
  );

  await updateUserById(userId, allowedUpdates);
  return { message: "Profile Updated" };
};

const updateAvatar = async (userId, file, protocol, host) => {
  const serverUrl = `${protocol}://${host}`;
  const fileUrl = `${serverUrl}/uploads/${userId}/${file.filename}`;
  
  await updateUserById(userId, { profilePic: fileUrl });
  return { url: fileUrl, message: "头像上传成功" };
};

const deleteAccount = async (userId) => {
  const user = await findUserById(userId);
  if (!user) {
    return { error: "User not found", status: 404 };
  }

  const anonymisedEmail = `deleted-${crypto.randomUUID()}-${user.email}`;

  await updateUserById(userId, {
    isDeleted: true,
    name: "Deleted Conversa User",
    about: "",
    email: anonymisedEmail,
    profilePic: "https://ui-avatars.com/api/?name=Deleted+User&background=808080&color=ffffff&bold=true",
    password: "",
    otp: "",
    otpExpiry: null,
    lastSeen: null
  });

  return { message: "Account deleted" };
};

const checkDuplicateUsers = async () => {
  const allUsers = await User.find({}).select("name email isBot isDeleted createdAt");
  
  const nameCounts = {};
  allUsers.forEach((u) => {
    const key = u.name;
    if (!nameCounts[key]) nameCounts[key] = [];
    nameCounts[key].push(u);
  });

  const duplicates = [];
  for (const [name, users] of Object.entries(nameCounts)) {
    if (users.length > 1 && !users[0].isBot) {
      duplicates.push({
        name,
        count: users.length,
        users: users.map((u) => ({
          id: u._id,
          email: u.email,
          isBot: u.isBot || false,
          isDeleted: u.isDeleted || false,
          createdAt: u.createdAt
        }))
      });
    }
  }

  return {
    total: allUsers.length,
    duplicates,
    allUsers: allUsers.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      isBot: u.isBot || false,
      isDeleted: u.isDeleted || false
    }))
  };
};

module.exports = {
  findUserById,
  findUserByIdSelect,
  updateUserById,
  getOnlineStatus,
  blockUser,
  unblockUser,
  getBlockStatus,
  getNonFriendsList,
  updateProfile,
  updateAvatar,
  deleteAccount,
  checkDuplicateUsers,
};
