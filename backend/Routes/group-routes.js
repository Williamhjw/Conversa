const express = require("express");
const router = express.Router();
const fetchUser = require("../middleware/fetchUser.js");
const {
  createGroup,
  getGroupDetails,
  updateGroup,
  addMembers,
  removeMember,
  leaveGroup,
  setAdmin,
  transferOwnership,
  summarizeUnread,
} = require("../Controllers/group-controller.js");

router.post("/create", fetchUser, createGroup);
router.get("/:groupId", fetchUser, getGroupDetails);
router.put("/:groupId", fetchUser, updateGroup);
router.post("/:groupId/members", fetchUser, addMembers);
router.delete("/:groupId/members/:memberId", fetchUser, removeMember);
router.post("/:groupId/leave", fetchUser, leaveGroup);
router.put("/:groupId/admin/:memberId", fetchUser, setAdmin);
router.put("/:groupId/transfer/:newOwnerId", fetchUser, transferOwnership);
router.post("/:groupId/summarize-unread", fetchUser, summarizeUnread);

module.exports = router;
