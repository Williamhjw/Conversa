const mongoose = require("mongoose");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/";
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "conversa";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    isBot: Boolean,
    isDeleted: Boolean,
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId }],
    lastSeen: Date,
  },
  { strict: false }
);

const User = mongoose.model("User", UserSchema);

const ConversationSchema = new mongoose.Schema(
  {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isGroup: Boolean,
    groupName: String,
  },
  { strict: false }
);

const Conversation = mongoose.model("Conversation", ConversationSchema);

async function diagnose() {
  try {
    await mongoose.connect(MONGO_URI + MONGO_DB_NAME);
    console.log("Connected to MongoDB\n");

    const users = await User.find({ isBot: { $ne: true }, isDeleted: { $ne: true } })
      .select("name email blockedUsers lastSeen createdAt");
    
    console.log("=== 所有用户 ===");
    for (const u of users) {
      console.log(`\n用户: ${u.name} (${u.email})`);
      console.log(`  ID: ${u._id}`);
      console.log(`  blockedUsers: ${u.blockedUsers?.length || 0} 个`);
      console.log(`  lastSeen: ${u.lastSeen || "无"}`);
      console.log(`  createdAt: ${u.createdAt}`);
    }

    console.log("\n\n=== 所有对话 ===");
    const conversations = await Conversation.find({}).populate("members", "name email");
    
    for (const c of conversations) {
      const memberNames = c.members.map(m => m.name).join(", ");
      console.log(`\n对话: ${c._id}`);
      console.log(`  类型: ${c.isGroup ? "群组" : "私聊"}`);
      if (c.isGroup) {
        console.log(`  群名: ${c.groupName}`);
      }
      console.log(`  成员: ${memberNames}`);
    }

    console.log("\n\n=== 诊断 getNonFriendsList ===");
    for (const user of users) {
      console.log(`\n用户 "${user.name}" 的候选人列表分析:`);
      
      const userConversations = await Conversation.find({ 
        members: { $in: [user._id] },
        isGroup: { $ne: true }
      });
      
      const excludedIds = userConversations.flatMap((c) => c.members.map(m => m.toString()));
      console.log(`  已有私聊的成员ID: ${[...new Set(excludedIds.filter(id => id !== user._id.toString()))].join(", ") || "无"}`);
      
      const candidates = await User.find({
        _id: { $nin: excludedIds },
        email: { $not: /bot$/ },
        isDeleted: { $ne: true }
      }).select("name email");
      
      console.log(`  可见候选人: ${candidates.map(c => c.name).join(", ") || "无"}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

diagnose();
