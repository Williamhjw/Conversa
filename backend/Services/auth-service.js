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

const getMailTransporter = () => mailTransporter;

const findUserByEmail = async (email) => {
  return User.findOne({ email });
};

const findUserById = async (id) => {
  return User.findById(id);
};

const createUser = async (userData) => {
  return User.create(userData);
};

const deleteUser = async (id) => {
  return User.findByIdAndDelete(id);
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

const generateToken = (userId, expiresIn = "7d") => {
  const data = { user: { id: userId } };
  return jwt.sign(data, JWT_SECRET, { expiresIn });
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

const hashOtp = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp.toString(), salt);
};

const compareOtp = async (otp, hashedOtp) => {
  return bcrypt.compare(otp.toString(), hashedOtp.toString());
};

const sendEmail = async (mailDetails) => {
  if (!mailTransporter) {
    throw new Error("MAIL_NOT_CONFIGURED");
  }
  return mailTransporter.sendMail(mailDetails);
};

const createConversation = async (memberIds) => {
  return Conversation.create({
    members: memberIds,
    unreadCounts: memberIds.map((memberId) => ({
      userId: memberId,
      count: 0,
    })),
  });
};

const cleanupDeletedUser = async (email) => {
  const botEmail = email + "bot";
  await User.deleteOne({ email: botEmail });
  const deletedUserPattern = new RegExp(`^deleted-.*-${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  const deletedUser = await User.findOne({ email: deletedUserPattern });
  if (deletedUser) {
    await User.findByIdAndDelete(deletedUser._id);
    console.log(`Cleaned up deleted user: ${email}`);
  }
};

const cleanupOrphanedBot = async (email) => {
  const botEmail = email + "bot";
  const existingBot = await User.findOne({ email: botEmail });
  if (existingBot) {
    await User.findByIdAndDelete(existingBot._id);
    console.log(`Cleaning up orphaned bot user: ${botEmail}`);
  }
};

const registerUser = async (name, email, password) => {
  let newUser = null;
  let botUser = null;

  try {
    const existingUser = await findUserByEmail(email);
    
    if (existingUser && !existingUser.isDeleted) {
      return { error: "该邮箱已被注册", status: 400 };
    }
    
    if (existingUser && existingUser.isDeleted) {
      console.log(`Cleaning up deleted user account: ${email}`);
      await cleanupDeletedUser(email);
      await User.findByIdAndDelete(existingUser._id);
    }
    
    await cleanupDeletedUser(email);
    await cleanupOrphanedBot(email);

    const imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&bold=true`;
    const hashedPassword = await hashPassword(password);

    newUser = await createUser({
      name,
      email,
      password: hashedPassword,
      profilePic: imageUrl,
      about: "Hello World!!",
      isEmailVerified: true,
    });

    botUser = await createUser({
      name: "AI Chatbot",
      email: email + "bot",
      password: hashedPassword,
      about: "I am an AI Chatbot to help you",
      profilePic: "https://play-lh.googleusercontent.com/Oe0NgYQ63TGGEr7ViA2fGA-yAB7w2zhMofDBR3opTGVvsCFibD8pecWUjHBF_VnVKNdJ",
      isBot: true,
      isEmailVerified: true,
    });

    await createConversation([newUser._id, botUser._id]);

    const token = generateToken(newUser.id);
    return { token, user: newUser };
  } catch (error) {
    try {
      if (newUser) await deleteUser(newUser._id);
      if (botUser) await deleteUser(botUser._id);
    } catch (cleanupError) {
      console.error("Cleanup after failed registration also failed:", cleanupError.message);
    }
    throw error;
  }
};

const loginUser = async (email, password, otp) => {
  const user = await findUserByEmail(email);

  if (!user) {
    return { error: "Invalid Credentials", status: 400 };
  }

  if (user.isDeleted) {
    return { error: "该账户已被注销，请重新注册", status: 400 };
  }

  if (otp) {
    const isValidOtp = await compareOtp(otp, user.otp);
    if (!isValidOtp) {
      return { error: "Invalid otp", status: 400 };
    }
    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return { error: "OTP expired", status: 400 };
    }
    user.otp = "";
    await user.save();
  } else {
    const passwordCompare = await comparePassword(password, user.password);
    if (!passwordCompare) {
      return { error: "Invalid Credentials", status: 400 };
    }
  }

  const token = generateToken(user.id);
  return {
    token,
    user: {
      _id: user.id,
      name: user.name,
      email: user.email,
      profilePic: user.profilePic,
      isEmailVerified: user.isEmailVerified,
    },
  };
};

const generateAndSaveOtp = async (user) => {
  const otp = generateOtp();
  const hashedOtp = await hashOtp(otp);
  user.otp = hashedOtp;
  user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();
  return otp;
};

const generateAndSaveVerificationOtp = async (user) => {
  const otp = generateOtp();
  const hashedOtp = await hashOtp(otp);
  user.otp = hashedOtp;
  user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();
  return otp;
};

const verifyUserEmail = async (user, otp) => {
  if (!user.otp || !user.otpExpiry) {
    return { error: "No OTP found. Please request a new one.", status: 400 };
  }

  if (user.otpExpiry < new Date()) {
    return { error: "OTP has expired. Please request a new one.", status: 400 };
  }

  const isValid = await compareOtp(otp, user.otp);
  if (!isValid) {
    return { error: "Invalid OTP", status: 400 };
  }

  user.isEmailVerified = true;
  user.otp = "";
  user.otpExpiry = null;
  await user.save();
  return { success: true };
};

module.exports = {
  getMailTransporter,
  findUserByEmail,
  findUserById,
  createUser,
  deleteUser,
  hashPassword,
  comparePassword,
  generateToken,
  generateOtp,
  hashOtp,
  compareOtp,
  sendEmail,
  createConversation,
  registerUser,
  loginUser,
  generateAndSaveOtp,
  generateAndSaveVerificationOtp,
  verifyUserEmail,
};
