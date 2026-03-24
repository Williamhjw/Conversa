const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../Models/User.js");
const Conversation = require("../Models/Conversation.js");
const { JWT_SECRET, EMAIL, PASSWORD } = require("../secrets.js");

const SMTP_HOST = process.env.SMTP_HOST || "smtp.qq.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE !== "false";

let mailTransporter = null;

const initMailTransporter = () => {
  if (!EMAIL || !PASSWORD) {
    console.log("⚠️ EMAIL or PASSWORD not configured, email features disabled");
    return null;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: EMAIL,
        pass: PASSWORD,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });
    
    transporter.verify((error, success) => {
      if (error) {
        console.error("❌ SMTP connection error:", error.message);
      } else {
        console.log(`✅ SMTP connected: ${SMTP_HOST}:${SMTP_PORT}`);
      }
    });
    
    return transporter;
  } catch (error) {
    console.error("❌ Failed to create mail transporter:", error.message);
    return null;
  }
};

mailTransporter = initMailTransporter();


const register = async (req, res) => {
  // Registration involves 3 dependent DB writes:
  //   1. Create the new user
  //   2. Create a personal AI bot user tied to this account
  //   3. Create the initial conversation between the user and their bot
  //
  // All three must succeed together. MongoDB transactions require a replica set,
  // so instead we use manual compensation: track every document that gets
  // created and delete them all if any subsequent step fails, leaving the DB
  // in a clean state (no partial accounts).
  let newUser = null;
  let botUser = null;

  try {
    console.log("register request received");

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Please fill all the fields",
      });
    }

    // Check for existing user with exact email
    const existingUser = await User.findOne({ email });
    
    // If user exists and is NOT deleted, reject registration
    if (existingUser && !existingUser.isDeleted) {
      return res.status(400).json({
        error: "该邮箱已被注册",
      });
    }
    
    // If user exists but IS deleted, clean up and allow re-registration
    if (existingUser && existingUser.isDeleted) {
      console.log(`Cleaning up deleted user account: ${email}`);
      const botEmail = email + "bot";
      await User.deleteOne({ email: botEmail });
      await User.findByIdAndDelete(existingUser._id);
    }
    
    // Check for deleted user with modified email (email format: deleted-xxx-original@email.com)
    const deletedUserPattern = new RegExp(`^deleted-.*-${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
    const deletedUser = await User.findOne({ email: deletedUserPattern });
    
    // Clean up deleted user and bot if found
    if (deletedUser) {
      console.log(`Found deleted user with email pattern: ${deletedUser.email}`);
      const botEmail = email + "bot";
      await User.deleteOne({ email: botEmail });
      await User.findByIdAndDelete(deletedUser._id);
      console.log(`Cleaned up deleted user: ${email}`);
    }

    // Check and clean up any orphaned bot user from previous incomplete registration
    const botEmail = email + "bot";
    const existingBot = await User.findOne({ email: botEmail });
    if (existingBot) {
      console.log(`Cleaning up orphaned bot user: ${botEmail}`);
      await User.findByIdAndDelete(existingBot._id);
    }

    var imageUrl = `https://ui-avatars.com/api/?name=${name}&background=random&bold=true`;

    const salt = await bcrypt.genSalt(10);
    const secPass = await bcrypt.hash(password, salt);

    // Write 1: create the real user account
    newUser = await User.create({
      name,
      email,
      password: secPass,
      profilePic: imageUrl,
      about: "Hello World!!",
      isEmailVerified: true, // 自动验证邮箱，跳过邮件验证
    });

    // Write 2: create the dedicated bot user for this account.
    // Each real user gets their own bot instance so conversations stay isolated.
    botUser = await User.create({
      name: "AI Chatbot",
      email: email + "bot",
      password: secPass,
      about: "I am an AI Chatbot to help you",
      profilePic:
        "https://play-lh.googleusercontent.com/Oe0NgYQ63TGGEr7ViA2fGA-yAB7w2zhMofDBR3opTGVvsCFibD8pecWUjHBF_VnVKNdJ",
      isBot: true,
      isEmailVerified: true, // bots are system accounts — no email verification needed
    });

    // Write 3: create the initial conversation between the user and their bot
    await Conversation.create({
      members: [newUser._id, botUser._id],
      unreadCounts: [
        { userId: newUser._id, count: 0 },
        { userId: botUser._id, count: 0 },
      ],
    });

    const data = {
      user: {
        id: newUser.id,
      },
    };

    const authtoken = jwt.sign(data, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      authtoken,
    });
  } catch (error) {
    // Something went wrong during one of the DB writes.
    // Manually delete any documents that were already created so we don't
    // leave behind partial data (e.g. a user with no bot, or a bot with no
    // conversation). This is the compensation step in lieu of a transaction.
    try {
      if (newUser) await User.findByIdAndDelete(newUser._id);
      if (botUser) await User.findByIdAndDelete(botUser._id);
    } catch (cleanupError) {
      // Log but don't mask the original error
      console.error("Cleanup after failed registration also failed:", cleanupError.message);
    }
    console.error(error.message);
    
    // Handle MongoDB validation errors with friendly messages
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => {
        if (err.path === 'name') {
          if (err.kind === 'minlength') return '姓名至少需要3个字符';
          if (err.kind === 'maxlength') return '姓名不能超过50个字符';
          return '姓名格式不正确';
        }
        if (err.path === 'email') return '邮箱格式不正确';
        if (err.path === 'password') return '密码至少需要6个字符';
        return err.message;
      });
      return res.status(400).json({ error: messages[0] });
    }
    
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const login = async (req, res) => {
  console.log("login request received");

  try {
    const { email, password, otp } = req.body;

    if (!email || (!password && !otp)) {
      return res.status(400).json({
        error: "Please fill all the fields",
      });
    }

    const user = await User.findOne({
      email: email,
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid Credentials",
      });
    }

    if (user.isDeleted) {
      return res.status(400).json({
        error: "该账户已被注销，请重新注册",
      });
    }

    if (otp) {
      const isValidOtp = await bcrypt.compare(otp.toString(), user.otp.toString());
      if (!isValidOtp) {
        return res.status(400).json({
          error: "Invalid otp",
        });
      }
      if (!user.otpExpiry || user.otpExpiry < new Date()) {
        return res.status(400).json({ error: "OTP expired" });
      }
      user.otp = "";
      await user.save();
    } else {
      const passwordCompare = await bcrypt.compare(password, user.password);
      if (!passwordCompare) {
        return res.status(400).json({
          error: "Invalid Credentials",
        });
      }
    }

    const data = {
      user: {
        id: user.id,
      },
    };

    const authtoken = jwt.sign(data, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      authtoken,
      user: {
        _id: user.id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const authUser = async (req, res) => {
  try {
    // we get req.user from the fetchuser middleware, which verifies the JWT and extracts the user ID
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const sendotp = async (req, res) => {
  try {
    console.log("sendotp request received");
    const { email } = req.body;
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json({
        error: "User not found",
      });
    }
    if (user.isDeleted) {
      return res.status(400).json({
        error: "该账户已被注销，请重新注册",
      });
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp.toString(), salt);
    user.otp = hashedOtp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes
    await user.save();

    let mailDetails = {
      from: `"Conversa" <${EMAIL}>`,
      to: email,
      subject: "Your Conversa Login OTP - " + otp,
      html: `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Your Conversa OTP</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:40px 0;">
    <tr>
      <td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
        <td align="center" style="background-color:#6366f1;padding:36px 40px;">
          <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:0.5px;">Conversa</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">online chatting platform</p>
        </td>
        </tr>

        <!-- Body -->
        <tr>
        <td style="padding:40px 40px 32px;">
          <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hello,</p>
          <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
          We received a request to sign in to your Conversa account. Use the one-time password below to complete your login.
          </p>

          <!-- OTP Box -->
          <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background-color:#f5f3ff;border:2px dashed #8b5cf6;border-radius:10px;padding:24px;">
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">One-Time Password</p>
            <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:10px;color:#6366f1;">${otp}</p>
            </td>
          </tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;text-align:center;">
          This OTP is valid for <strong style="color:#374151;">5 minutes</strong>. Do not share it with anyone.
          </p>
        </td>
        </tr>

        <!-- Warning -->
        <tr>
        <td style="padding:0 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;">
            <p style="margin:0;font-size:13px;color:#92400e;">
              If you did not request this OTP, you can safely ignore this email. Your account remains secure.
            </p>
            </td>
          </tr>
          </table>
        </td>
        </tr>

        <!-- Footer -->
        <tr>
        <td align="center" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
          &copy; ${new Date().getFullYear()} Conversa. All rights reserved.
          </p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">
          This is an automated message — please do not reply.
          </p>
        </td>
        </tr>

      </table>
      </td>
    </tr>
    </table>
  </body>
  </html>`,
    };

    // Check if mail transporter is available
    if (!mailTransporter) {
      console.error("Mail transporter not initialized");
      return res.status(500).json({ 
        message: "邮件服务未配置，请联系管理员",
        error: "MAIL_NOT_CONFIGURED"
      });
    }

    // Use promise-based approach
    try {
      await mailTransporter.sendMail(mailDetails);
      return res.status(200).json({ message: "OTP sent" });
    } catch (err) {
      console.error("Mail error:", err.message);
      return res.status(500).json({ 
        message: "邮件发送失败，请检查邮箱配置或稍后重试",
        error: err.message 
      });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const sendVerificationOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isEmailVerified)
      return res.status(400).json({ error: "Email is already verified" });

    const otp = Math.floor(100000 + Math.random() * 900000);
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp.toString(), salt);
    user.otp = hashedOtp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    const mailDetails = {
      from: `"Conversa" <${EMAIL}>`,
      to: user.email,
      subject: `Verify your Conversa email – OTP: ${otp}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify Your Email</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background-color:#6366f1;padding:36px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:0.5px;">Conversa</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Verify your email address</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hello ${user.name},</p>
              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
                Please use the OTP below to verify your email address and unlock full access to Conversa.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background-color:#f5f3ff;border:2px dashed #8b5cf6;border-radius:10px;padding:24px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">Verification Code</p>
                    <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:10px;color:#6366f1;">${otp}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:13px;color:#6b7280;text-align:center;">
                This code is valid for <strong style="color:#374151;">10 minutes</strong>. Do not share it with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      If you did not sign up for Conversa, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} Conversa. All rights reserved.</p>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">This is an automated message — please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };

    // Check if mail transporter is available
    if (!mailTransporter) {
      console.error("Mail transporter not initialized");
      return res.status(500).json({ 
        message: "邮件服务未配置，请联系管理员",
        error: "MAIL_NOT_CONFIGURED"
      });
    }

    try {
      await mailTransporter.sendMail(mailDetails);
      return res.status(200).json({ message: "Verification OTP sent" });
    } catch (err) {
      console.error("Mail error:", err.message);
      return res.status(500).json({ 
        message: "邮件发送失败，请检查邮箱配置或稍后重试",
        error: err.message 
      });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: "OTP is required" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isEmailVerified)
      return res.status(400).json({ error: "Email is already verified" });

    if (!user.otp || !user.otpExpiry)
      return res.status(400).json({ error: "No OTP found. Please request a new one." });

    if (user.otpExpiry < new Date())
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });

    const isValid = await bcrypt.compare(otp.toString(), user.otp);
    if (!isValid) return res.status(400).json({ error: "Invalid OTP" });

    user.isEmailVerified = true;
    user.otp = "";
    user.otpExpiry = null;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "服务器内部错误，请稍后重试" });
  }
};

module.exports = {
  register,
  login,
  authUser,
  sendotp,
  sendVerificationOtp,
  verifyEmail,
};
