const mongoose = require("mongoose");
require("dotenv").config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/conversa";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    isBot: Boolean,
    isDeleted: Boolean,
  },
  { strict: false }
);

const User = mongoose.model("User", UserSchema);

async function checkDuplicateUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    const allUsers = await User.find({}).select("name email isBot isDeleted createdAt");
    
    console.log("=== 所有用户列表 ===");
    allUsers.forEach((u) => {
      console.log(`ID: ${u._id}`);
      console.log(`  名称: ${u.name}`);
      console.log(`  邮箱: ${u.email}`);
      console.log(`  是否Bot: ${u.isBot || false}`);
      console.log(`  是否删除: ${u.isDeleted || false}`);
      console.log(`  创建时间: ${u.createdAt}`);
      console.log("---");
    });

    console.log(`\n总共 ${allUsers.length} 个用户\n`);

    const nameCounts = {};
    allUsers.forEach((u) => {
      const key = u.name;
      if (!nameCounts[key]) nameCounts[key] = [];
      nameCounts[key].push(u);
    });

    console.log("=== 重复名称检查 ===");
    let hasDuplicates = false;
    for (const [name, users] of Object.entries(nameCounts)) {
      if (users.length > 1) {
        hasDuplicates = true;
        console.log(`\n名称 "${name}" 有 ${users.length} 个用户:`);
        users.forEach((u) => {
          console.log(`  - ${u.email} (Bot: ${u.isBot || false}, Deleted: ${u.isDeleted || false})`);
        });
      }
    }

    if (!hasDuplicates) {
      console.log("没有发现重复名称的用户");
    }

    const emailCounts = {};
    allUsers.forEach((u) => {
      const key = u.email;
      if (!emailCounts[key]) emailCounts[key] = [];
      emailCounts[key].push(u);
    });

    console.log("\n=== 重复邮箱检查 ===");
    let hasEmailDuplicates = false;
    for (const [email, users] of Object.entries(emailCounts)) {
      if (users.length > 1) {
        hasEmailDuplicates = true;
        console.log(`\n邮箱 "${email}" 有 ${users.length} 个用户:`);
        users.forEach((u) => {
          console.log(`  - ID: ${u._id}, 名称: ${u.name}`);
        });
      }
    }

    if (!hasEmailDuplicates) {
      console.log("没有发现重复邮箱的用户");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkDuplicateUsers();
