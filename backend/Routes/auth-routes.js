const express = require("express");
const router = express.Router();

const {
  register,
  login,
  authUser,
  sendotp,
  sendVerificationOtp,
  verifyEmail,
} = require("../Controllers/auth-controller.js");
const fetchuser = require("../middleware/fetchUser.js");
const User = require("../Models/User.js");

router.post("/register", register);
router.post("/login", login);
router.post("/getotp", sendotp);
router.get("/me", fetchuser, authUser);
router.post("/send-verification-otp", fetchuser, sendVerificationOtp);
router.post("/verify-email", fetchuser, verifyEmail);

// 临时调试端点 - 检查用户状态
router.get("/debug-user/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const users = await User.find({
      $or: [
        { email: email },
        { email: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      ]
    }).select('name email isDeleted isBot createdAt');

    res.json({
      email: email,
      count: users.length,
      users: users.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        isDeleted: u.isDeleted || false,
        isBot: u.isBot || false,
        createdAt: u.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 临时调试端点 - 清理用户（GET方法，方便浏览器访问）
router.get("/debug-cleanup/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const botEmail = email + "bot";
    
    // 查找所有相关用户
    const users = await User.find({
      $or: [
        { email: email },
        { email: botEmail },
        { email: new RegExp(`^deleted-.*-${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }
      ]
    });

    let deleted = [];
    for (const user of users) {
      await User.findByIdAndDelete(user._id);
      deleted.push(user.email);
    }

    res.json({
      message: "清理完成",
      deleted: deleted
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 临时调试端点 - 验证用户邮箱
router.get("/debug-verify/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }
    
    user.isEmailVerified = true;
    await user.save();
    
    res.json({
      message: "邮箱验证成功",
      email: user.email,
      isEmailVerified: user.isEmailVerified
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
