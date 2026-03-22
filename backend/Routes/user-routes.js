const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const fetchuser = require("../middleware/fetchUser.js");

const {
  getOnlineStatus,
  getNonFriendsList,
  updateprofile,
  uploadAvatar,
  blockUser,
  unblockUser,
  getBlockStatus,
  deleteAccount,
  checkDuplicateUsers,
} = require("../Controllers/user-controller.js");

// Configure multer for avatar upload
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadsDir, req.user?.id || "anonymous");
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "avatar-" + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("仅支持图片文件"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.put("/update", fetchuser, updateprofile);
router.get("/online-status/:id", fetchuser, getOnlineStatus);
router.get("/non-friends", fetchuser, getNonFriendsList);
router.post("/avatar", fetchuser, upload.single("avatar"), uploadAvatar);
router.post("/block/:id", fetchuser, blockUser);
router.delete("/block/:id", fetchuser, unblockUser);
router.get("/block-status/:id", fetchuser, getBlockStatus);
router.delete("/delete", fetchuser, deleteAccount);
router.get("/check-duplicates", fetchuser, checkDuplicateUsers);

module.exports = router;
