const express = require("express");
const router = express.Router();

const {
  createConversation,
  getConversation,
  getConversationList,
  togglePin,
  deleteConversation,
} = require("../Controllers/conversation-controller.js");
const fetchuser = require("../middleware/fetchUser.js");

router.post("/", fetchuser, createConversation);
router.get("/", fetchuser, getConversationList);
router.get("/:id", fetchuser, getConversation);
router.post("/:id/pin", fetchuser, togglePin);
router.delete("/:id", fetchuser, deleteConversation);

module.exports = router;
