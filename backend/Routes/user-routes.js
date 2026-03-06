const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchUser.js");

const {
  getPresignedUrl,
  getOnlineStatus,
  getNonFriendsList,
  updateprofile,
} = require("../Controllers/user-controller.js");

router.put("/update", fetchuser, updateprofile);
router.get("/online-status/:id", fetchuser, getOnlineStatus);
router.get("/non-friends", fetchuser, getNonFriendsList);
router.get("/presigned-url", fetchuser, getPresignedUrl);

module.exports = router;
