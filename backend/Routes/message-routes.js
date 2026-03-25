const express = require("express");
const router = express.Router();

const {
  getMessages,
  deleteMessage,
  bulkHideMessages,
  clearChat,
  toggleStar,
  getStarredMessages,
  translate,
} = require("../Controllers/message-controller.js");
const fetchuser = require("../middleware/fetchUser.js");

router.post("/translate", fetchuser, translate);
router.get("/starred", fetchuser, getStarredMessages);
router.get("/:id", fetchuser, getMessages);
router.delete("/bulk/hide", fetchuser, bulkHideMessages);
router.delete("/:id", fetchuser, deleteMessage);
router.post("/clear/:conversationId", fetchuser, clearChat);
router.post("/:id/star", fetchuser, toggleStar);

module.exports = router;
