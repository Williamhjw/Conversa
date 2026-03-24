const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../Models/User.js');
const Conversation = require('../Models/Conversation.js');

const cleanupUser = async () => {
  try {
    const email = process.argv[2];
    
    if (!email) {
      console.log('用法: node scripts/cleanup-user.js <email>');
      console.log('示例: node scripts/cleanup-user.js williamhjw4@qq.com');
      process.exit(1);
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('错误: MONGO_URI 未配置');
      process.exit(1);
    }

    console.log(`正在连接数据库...`);
    console.log(`MONGO_URI: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    
    await mongoose.connect(mongoUri);
    console.log(`数据库连接成功`);

    // 查找用户
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`未找到邮箱为 ${email} 的用户`);
      
      // 检查是否有 deleted 开头的邮箱
      const deletedUser = await User.findOne({ 
        email: { $regex: `deleted-.*-${email}$` }
      });
      
      if (deletedUser) {
        console.log(`找到已删除的用户记录: ${deletedUser.email}`);
        console.log(`正在清理...`);
        
        // 删除关联的 bot 用户
        const botEmail = email + 'bot';
        const botUser = await User.findOne({ email: botEmail });
        if (botUser) {
          await User.findByIdAndDelete(botUser._id);
          console.log(`已删除 bot 用户: ${botEmail}`);
        }
        
        // 删除已删除的用户记录
        await User.findByIdAndDelete(deletedUser._id);
        console.log(`已删除用户记录: ${deletedUser.email}`);
        
        // 删除相关会话
        const result = await Conversation.deleteMany({
          members: deletedUser._id
        });
        console.log(`已删除 ${result.deletedCount} 个相关会话`);
      }
      
      process.exit(0);
    }

    console.log(`找到用户:`);
    console.log(`  ID: ${user._id}`);
    console.log(`  名称: ${user.name}`);
    console.log(`  邮箱: ${user.email}`);
    console.log(`  是否已删除: ${user.isDeleted || false}`);
    console.log(`  是否为Bot: ${user.isBot || false}`);

    // 查找关联的 bot 用户
    const botEmail = email + 'bot';
    const botUser = await User.findOne({ email: botEmail });
    
    if (botUser) {
      console.log(`\n找到关联的 Bot 用户:`);
      console.log(`  ID: ${botUser._id}`);
      console.log(`  邮箱: ${botEmail}`);
    }

    console.log(`\n正在删除用户和相关数据...`);

    // 删除用户
    await User.findByIdAndDelete(user._id);
    console.log(`✓ 已删除用户: ${email}`);

    // 删除 bot 用户
    if (botUser) {
      await User.findByIdAndDelete(botUser._id);
      console.log(`✓ 已删除 Bot 用户: ${botEmail}`);
    }

    // 删除相关会话
    const result = await Conversation.deleteMany({
      members: user._id
    });
    console.log(`✓ 已删除 ${result.deletedCount} 个相关会话`);

    console.log(`\n清理完成！`);
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
};

cleanupUser();
