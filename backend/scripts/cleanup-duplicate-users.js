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
    createdAt: Date,
  },
  { strict: false, timestamps: true }
);

const User = mongoose.model("User", UserSchema);

const ConversationSchema = new mongoose.Schema(
  {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isGroup: Boolean,
  },
  { strict: false }
);

const Conversation = mongoose.model("Conversation", ConversationSchema);

async function cleanupDuplicateUsers() {
  try {
    await mongoose.connect(MONGO_URI + MONGO_DB_NAME);
    console.log("Connected to MongoDB\n");

    const allUsers = await User.find({}).sort({ createdAt: 1 });
    
    const nameGroups = {};
    allUsers.forEach((u) => {
      const key = u.name;
      if (!nameGroups[key]) nameGroups[key] = [];
      nameGroups[key].push(u);
    });

    const toDelete = [];
    
    for (const [name, users] of Object.entries(nameGroups)) {
      if (users.length > 1 && !users[0].isBot) {
        console.log(`\n发现重复用户 "${name}" (${users.length} 个):`);
        users.forEach((u, idx) => {
          console.log(`  [${idx}] ${u.email} - 创建于: ${u.createdAt}`);
        });
        
        users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const keepUser = users[0];
        const deleteUsers = users.slice(1);
        
        console.log(`  ✓ 保留: ${keepUser.email} (最新)`);
        deleteUsers.forEach((u) => {
          console.log(`  ✗ 删除: ${u.email}`);
          toDelete.push(u._id);
        });
      }
    }

    if (toDelete.length === 0) {
      console.log("\n没有发现需要删除的重复用户");
      process.exit(0);
      return;
    }

    console.log(`\n总共将删除 ${toDelete.length} 个重复用户`);
    console.log("\n删除的用户 ID:", toDelete.map(id => id.toString()));

    for (const userId of toDelete) {
      const conversations = await Conversation.find({ members: userId });
      for (const conv of conversations) {
        if (conv.members.length <= 2) {
          await Conversation.deleteOne({ _id: conv._id });
          console.log(`  删除对话: ${conv._id}`);
        } else {
          await Conversation.updateOne(
            { _id: conv._id },
            { $pull: { members: userId } }
          );
          console.log(`  从群组移除成员: ${conv._id}`);
        }
      }
    }

    const deleteResult = await User.deleteMany({ _id: { $in: toDelete } });
    console.log(`\n成功删除 ${deleteResult.deletedCount} 个用户`);

    const remainingUsers = await User.find({}).select("name email isBot");
    console.log("\n=== 剩余用户 ===");
    remainingUsers.forEach((u) => {
      console.log(`  ${u.name} (${u.email}) ${u.isBot ? "[Bot]" : ""}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

cleanupDuplicateUsers();
