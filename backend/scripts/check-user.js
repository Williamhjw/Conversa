const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../Models/User.js');

const checkUser = async () => {
  try {
    const email = process.argv[2] || 'williamhjw4@qq.com';
    
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('错误: MONGO_URI 未配置');
      process.exit(1);
    }

    console.log(`正在连接数据库...`);
    await mongoose.connect(mongoUri);
    console.log(`数据库连接成功\n`);

    // 查找所有相关用户
    console.log(`=== 查找邮箱包含 "${email}" 的用户 ===\n`);
    
    const users = await User.find({
      $or: [
        { email: email },
        { email: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      ]
    }).select('name email isDeleted isBot createdAt');

    if (users.length === 0) {
      console.log('未找到任何相关用户');
    } else {
      console.log(`找到 ${users.length} 个用户:\n`);
      users.forEach((u, i) => {
        console.log(`${i + 1}. ${u.name}`);
        console.log(`   邮箱: ${u.email}`);
        console.log(`   已删除: ${u.isDeleted || false}`);
        console.log(`   是Bot: ${u.isBot || false}`);
        console.log(`   创建时间: ${u.createdAt}`);
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
};

checkUser();
