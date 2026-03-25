const express = require("express");
const router = express.Router();

const {
  getConversation,
  getConversationById,
  getConversations,
  togglePin,
  deleteConversation,
} = require("../Controllers/conversation-controller.js");
const fetchuser = require("../middleware/fetchUser.js");

router.post("/", fetchuser, getConversation);
router.get("/", fetchuser, getConversations);
router.get("/:id", fetchuser, getConversationById);
router.post("/:id/pin", fetchuser, togglePin);
router.delete("/:id", fetchuser, deleteConversation);

module.exports = router;
