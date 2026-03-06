const express = require("express");
const router = express.Router();

const {
  allMessage,
  deletemesage,
  getPresignedUrl,
} = require("../Controllers/message_controller.js");
const fetchuser = require("../middleware/fetchUser.js");

router.get("/presigned-url", fetchuser, getPresignedUrl);
router.get("/:id", fetchuser, allMessage);
router.post("/delete", fetchuser, deletemesage);

module.exports = router;
