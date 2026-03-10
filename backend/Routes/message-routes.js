const express = require("express");
const router = express.Router();

const {
  allMessage,
  deleteMessage,
  bulkHide,
  clearChat,
} = require("../Controllers/message-controller.js");
const fetchuser = require("../middleware/fetchUser.js");

router.get("/:id", fetchuser, allMessage);
router.delete("/bulk/hide", fetchuser, bulkHide);
router.delete("/:id", fetchuser, deleteMessage);
router.post("/clear/:conversationId", fetchuser, clearChat);

module.exports = router;
