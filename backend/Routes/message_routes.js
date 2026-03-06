const express = require("express");
const router = express.Router();

const {
  allMessage,
  deletemesage,
} = require("../Controllers/message_controller.js");
const fetchuser = require("../middleware/fetchUser.js");

router.get("/:id", fetchuser, allMessage);
router.post("/delete", fetchuser, deletemesage);

module.exports = router;
