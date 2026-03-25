const LeetCodeProblem = require("../Models/LeetCodeProblem.js");
const LeetCodeProgress = require("../Models/LeetCodeProgress.js");
const User = require("../Models/User.js");
const Conversation = require("../Models/Conversation.js");

const HOT_100_PROBLEMS = [
  { problemId: 1, title: "两数之和", titleSlug: "two-sum", difficulty: "Easy", tags: ["数组", "哈希表"] },
  { problemId: 49, title: "字母异位词分组", titleSlug: "group-anagrams", difficulty: "Medium", tags: ["数组", "哈希表", "字符串", "排序"] },
  { problemId: 128, title: "最长连续序列", titleSlug: "longest-consecutive-sequence", difficulty: "Medium", tags: ["并查集", "数组", "哈希表"] },
  { problemId: 283, title: "移动零", titleSlug: "move-zeroes", difficulty: "Easy", tags: ["数组", "双指针"] },
  { problemId: 11, title: "盛最多水的容器", titleSlug: "container-with-most-water", difficulty: "Medium", tags: ["贪心", "数组", "双指针"] },
  { problemId: 15, title: "三数之和", titleSlug: "3sum", difficulty: "Medium", tags: ["数组", "双指针", "排序"] },
  { problemId: 42, title: "接雨水", titleSlug: "trapping-rain-water", difficulty: "Hard", tags: ["栈", "数组", "双指针", "动态规划", "单调栈"] },
  { problemId: 3, title: "无重复字符的最长子串", titleSlug: "longest-substring-without-repeating-characters", difficulty: "Medium", tags: ["哈希表", "字符串", "滑动窗口"] },
  { problemId: 438, title: "找到字符串中所有字母异位词", titleSlug: "find-all-anagrams-in-a-string", difficulty: "Medium", tags: ["数组", "哈希表", "字符串", "滑动窗口"] },
  { problemId: 560, title: "和为 K 的子数组", titleSlug: "subarray-sum-equals-k", difficulty: "Medium", tags: ["数组", "哈希表", "前缀和"] },
  { problemId: 239, title: "滑动窗口最大值", titleSlug: "sliding-window-maximum", difficulty: "Hard", tags: ["队列", "数组", "滑动窗口", "单调队列", "堆（优先队列）"] },
  { problemId: 76, title: "最小覆盖子串", titleSlug: "minimum-window-substring", difficulty: "Hard", tags: ["哈希表", "字符串", "滑动窗口"] },
  { problemId: 53, title: "最大子数组和", titleSlug: "maximum-subarray", difficulty: "Medium", tags: ["数组", "分治", "动态规划"] },
  { problemId: 56, title: "合并区间", titleSlug: "merge-intervals", difficulty: "Medium", tags: ["数组", "排序"] },
  { problemId: 189, title: "轮转数组", titleSlug: "rotate-array", difficulty: "Medium", tags: ["数组", "数学", "双指针"] },
  { problemId: 238, title: "除自身以外数组的乘积", titleSlug: "product-of-array-except-self", difficulty: "Medium", tags: ["数组", "前缀和"] },
  { problemId: 41, title: "缺失的第一个正数", titleSlug: "first-missing-positive", difficulty: "Hard", tags: ["数组", "哈希表"] },
  { problemId: 73, title: "矩阵置零", titleSlug: "set-matrix-zeroes", difficulty: "Medium", tags: ["数组", "哈希表", "矩阵"] },
  { problemId: 54, title: "螺旋矩阵", titleSlug: "spiral-matrix", difficulty: "Medium", tags: ["数组", "矩阵", "模拟"] },
  { problemId: 48, title: "旋转图像", titleSlug: "rotate-image", difficulty: "Medium", tags: ["数组", "数学", "矩阵"] },
  { problemId: 240, title: "搜索二维矩阵 II", titleSlug: "search-a-2d-matrix-ii", difficulty: "Medium", tags: ["数组", "二分查找", "分治", "矩阵"] },
  { problemId: 160, title: "相交链表", titleSlug: "intersection-of-two-linked-lists", difficulty: "Easy", tags: ["哈希表", "链表", "双指针"] },
  { problemId: 206, title: "反转链表", titleSlug: "reverse-linked-list", difficulty: "Easy", tags: ["递归", "链表"] },
  { problemId: 234, title: "回文链表", titleSlug: "palindrome-linked-list", difficulty: "Easy", tags: ["栈", "递归", "链表", "双指针"] },
  { problemId: 141, title: "环形链表", titleSlug: "linked-list-cycle", difficulty: "Easy", tags: ["哈希表", "链表", "双指针"] },
  { problemId: 142, title: "环形链表 II", titleSlug: "linked-list-cycle-ii", difficulty: "Medium", tags: ["哈希表", "链表", "双指针"] },
  { problemId: 21, title: "合并两个有序链表", titleSlug: "merge-two-sorted-lists", difficulty: "Easy", tags: ["递归", "链表"] },
  { problemId: 2, title: "两数相加", titleSlug: "add-two-numbers", difficulty: "Medium", tags: ["递归", "链表", "数学"] },
  { problemId: 19, title: "删除链表的倒数第 N 个结点", titleSlug: "remove-nth-node-from-end-of-list", difficulty: "Medium", tags: ["链表", "双指针"] },
  { problemId: 24, title: "两两交换链表中的节点", titleSlug: "swap-nodes-in-pairs", difficulty: "Medium", tags: ["递归", "链表"] },
  { problemId: 25, title: "K 个一组翻转链表", titleSlug: "reverse-nodes-in-k-group", difficulty: "Hard", tags: ["递归", "链表"] },
  { problemId: 138, title: "随机链表的复制", titleSlug: "copy-list-with-random-pointer", difficulty: "Medium", tags: ["哈希表", "链表"] },
  { problemId: 148, title: "排序链表", titleSlug: "sort-list", difficulty: "Medium", tags: ["链表", "双指针", "分治", "排序", "归并排序"] },
  { problemId: 146, title: "LRU 缓存", titleSlug: "lru-cache", difficulty: "Medium", tags: ["设计", "哈希表", "链表", "双向链表"] },
  { problemId: 94, title: "二叉树的中序遍历", titleSlug: "binary-tree-inorder-traversal", difficulty: "Easy", tags: ["栈", "树", "深度优先搜索", "二叉树"] },
  { problemId: 104, title: "二叉树的最大深度", titleSlug: "maximum-depth-of-binary-tree", difficulty: "Easy", tags: ["树", "深度优先搜索", "广度优先搜索", "二叉树"] },
  { problemId: 226, title: "翻转二叉树", titleSlug: "invert-binary-tree", difficulty: "Easy", tags: ["树", "深度优先搜索", "广度优先搜索", "二叉树"] },
  { problemId: 101, title: "对称二叉树", titleSlug: "symmetric-tree", difficulty: "Easy", tags: ["树", "深度优先搜索", "广度优先搜索", "二叉树"] },
  { problemId: 543, title: "二叉树的直径", titleSlug: "diameter-of-binary-tree", difficulty: "Easy", tags: ["树", "深度优先搜索", "二叉树"] },
  { problemId: 102, title: "二叉树的层序遍历", titleSlug: "binary-tree-level-order-traversal", difficulty: "Medium", tags: ["树", "广度优先搜索", "二叉树"] },
  { problemId: 108, title: "将有序数组转换为二叉搜索树", titleSlug: "convert-sorted-array-to-binary-search-tree", difficulty: "Easy", tags: ["树", "二叉搜索树", "数组", "分治", "二叉树"] },
  { problemId: 98, title: "验证二叉搜索树", titleSlug: "validate-binary-search-tree", difficulty: "Medium", tags: ["树", "深度优先搜索", "二叉搜索树", "二叉树"] },
  { problemId: 230, title: "二叉搜索树中第 K 小的元素", titleSlug: "kth-smallest-element-in-a-bst", difficulty: "Medium", tags: ["树", "深度优先搜索", "二叉搜索树", "二叉树"] },
  { problemId: 199, title: "二叉树的右视图", titleSlug: "binary-tree-right-side-view", difficulty: "Medium", tags: ["树", "深度优先搜索", "广度优先搜索", "二叉树"] },
  { problemId: 114, title: "二叉树展开为链表", titleSlug: "flatten-binary-tree-to-linked-list", difficulty: "Medium", tags: ["栈", "树", "深度优先搜索", "链表", "二叉树"] },
  { problemId: 105, title: "从前序与中序遍历序列构造二叉树", titleSlug: "construct-binary-tree-from-preorder-and-inorder-traversal", difficulty: "Medium", tags: ["树", "数组", "哈希表", "分治", "二叉树"] },
  { problemId: 437, title: "路径总和 III", titleSlug: "path-sum-iii", difficulty: "Medium", tags: ["树", "深度优先搜索", "二叉树"] },
  { problemId: 236, title: "二叉树的最近公共祖先", titleSlug: "lowest-common-ancestor-of-a-binary-tree", difficulty: "Medium", tags: ["树", "深度优先搜索", "二叉树"] },
  { problemId: 124, title: "二叉树中的最大路径和", titleSlug: "binary-tree-maximum-path-sum", difficulty: "Hard", tags: ["树", "深度优先搜索", "动态规划", "二叉树"] },
  { problemId: 200, title: "岛屿数量", titleSlug: "number-of-islands", difficulty: "Medium", tags: ["深度优先搜索", "广度优先搜索", "并查集", "数组", "矩阵"] },
  { problemId: 994, title: "腐烂的橘子", titleSlug: "rotting-oranges", difficulty: "Medium", tags: ["广度优先搜索", "数组", "矩阵"] },
  { problemId: 207, title: "课程表", titleSlug: "course-schedule", difficulty: "Medium", tags: ["深度优先搜索", "广度优先搜索", "图", "拓扑排序"] },
  { problemId: 208, title: "实现 Trie (前缀树)", titleSlug: "implement-trie-prefix-tree", difficulty: "Medium", tags: ["设计", "字典树", "哈希表", "字符串"] },
  { problemId: 17, title: "电话号码的字母组合", titleSlug: "letter-combinations-of-a-phone-number", difficulty: "Medium", tags: ["哈希表", "字符串", "回溯"] },
  { problemId: 77, title: "组合", titleSlug: "combinations", difficulty: "Medium", tags: ["回溯"] },
  { problemId: 46, title: "全排列", titleSlug: "permutations", difficulty: "Medium", tags: ["数组", "回溯"] },
  { problemId: 78, title: "子集", titleSlug: "subsets", difficulty: "Medium", tags: ["位运算", "数组", "回溯"] },
  { problemId: 90, title: "子集 II", titleSlug: "subsets-ii", difficulty: "Medium", tags: ["位运算", "数组", "回溯"] },
  { problemId: 79, title: "单词搜索", titleSlug: "word-search", difficulty: "Medium", tags: ["数组", "回溯", "矩阵"] },
  { problemId: 39, title: "组合总和", titleSlug: "combination-sum", difficulty: "Medium", tags: ["数组", "回溯"] },
  { problemId: 22, title: "括号生成", titleSlug: "generate-parentheses", difficulty: "Medium", tags: ["字符串", "动态规划", "回溯"] },
  { problemId: 131, title: "分割回文串", titleSlug: "palindrome-partitioning", difficulty: "Medium", tags: ["字符串", "动态规划", "回溯"] },
  { problemId: 51, title: "N 皇后", titleSlug: "n-queens", difficulty: "Hard", tags: ["数组", "回溯"] },
  { problemId: 35, title: "搜索插入位置", titleSlug: "search-insert-position", difficulty: "Easy", tags: ["数组", "二分查找"] },
  { problemId: 74, title: "搜索二维矩阵", titleSlug: "search-a-2d-matrix", difficulty: "Medium", tags: ["数组", "二分查找", "矩阵"] },
  { problemId: 34, title: "在排序数组中查找元素的第一个和最后一个位置", titleSlug: "find-first-and-last-position-of-element-in-sorted-array", difficulty: "Medium", tags: ["数组", "二分查找"] },
  { problemId: 33, title: "搜索旋转排序数组", titleSlug: "search-in-rotated-sorted-array", difficulty: "Medium", tags: ["数组", "二分查找"] },
  { problemId: 153, title: "寻找旋转排序数组中的最小值", titleSlug: "find-minimum-in-rotated-sorted-array", difficulty: "Medium", tags: ["数组", "二分查找"] },
  { problemId: 4, title: "寻找两个正序数组的中位数", titleSlug: "median-of-two-sorted-arrays", difficulty: "Hard", tags: ["数组", "二分查找", "分治"] },
  { problemId: 69, title: "x 的平方根", titleSlug: "sqrtx", difficulty: "Easy", tags: ["数学", "二分查找"] },
  { problemId: 50, title: "Pow(x, n)", titleSlug: "powx-n", difficulty: "Medium", tags: ["递归", "数学"] },
  { problemId: 367, title: "有效的完全平方数", titleSlug: "valid-perfect-square", difficulty: "Easy", tags: ["数学", "二分查找"] },
  { problemId: 215, title: "数组中的第 K 个最大元素", titleSlug: "kth-largest-element-in-an-array", difficulty: "Medium", tags: ["数组", "分治", "快速选择", "排序", "堆（优先队列）"] },
  { problemId: 347, title: "前 K 个高频元素", titleSlug: "top-k-frequent-elements", difficulty: "Medium", tags: ["数组", "哈希表", "分治", "桶排序", "计数", "快速选择", "排序", "堆（优先队列）"] },
  { problemId: 295, title: "数据流的中位数", titleSlug: "find-median-from-data-stream", difficulty: "Hard", tags: ["设计", "双指针", "数据流", "排序", "堆（优先队列）"] },
  { problemId: 155, title: "最小栈", titleSlug: "min-stack", difficulty: "Medium", tags: ["栈", "设计"] },
  { problemId: 20, title: "有效的括号", titleSlug: "valid-parentheses", difficulty: "Easy", tags: ["栈", "字符串"] },
  { problemId: 394, title: "字符串解码", titleSlug: "decode-string", difficulty: "Medium", tags: ["栈", "递归", "字符串"] },
  { problemId: 739, title: "每日温度", titleSlug: "daily-temperatures", difficulty: "Medium", tags: ["栈", "数组", "单调栈"] },
  { problemId: 84, title: "柱状图中最大的矩形", titleSlug: "largest-rectangle-in-histogram", difficulty: "Hard", tags: ["栈", "数组", "单调栈"] },
  { problemId: 70, title: "爬楼梯", titleSlug: "climbing-stairs", difficulty: "Easy", tags: ["记忆化搜索", "数学", "动态规划"] },
  { problemId: 118, title: "杨辉三角", titleSlug: "pascals-triangle", difficulty: "Easy", tags: ["数组", "动态规划"] },
  { problemId: 198, title: "打家劫舍", titleSlug: "house-robber", difficulty: "Medium", tags: ["数组", "动态规划"] },
  { problemId: 279, title: "完全平方数", titleSlug: "perfect-squares", difficulty: "Medium", tags: ["广度优先搜索", "数学", "动态规划"] },
  { problemId: 322, title: "零钱兑换", titleSlug: "coin-change", difficulty: "Medium", tags: ["广度优先搜索", "数组", "动态规划"] },
  { problemId: 139, title: "单词拆分", titleSlug: "word-break", difficulty: "Medium", tags: ["字典树", "记忆化搜索", "数组", "哈希表", "字符串", "动态规划"] },
  { problemId: 300, title: "最长递增子序列", titleSlug: "longest-increasing-subsequence", difficulty: "Medium", tags: ["数组", "二分查找", "动态规划"] },
  { problemId: 152, title: "乘积最大子数组", titleSlug: "maximum-product-subarray", difficulty: "Medium", tags: ["数组", "动态规划"] },
  { problemId: 416, title: "分割等和子集", titleSlug: "partition-equal-subset-sum", difficulty: "Medium", tags: ["数组", "动态规划"] },
  { problemId: 32, title: "最长有效括号", titleSlug: "longest-valid-parentheses", difficulty: "Hard", tags: ["栈", "字符串", "动态规划"] },
  { problemId: 136, title: "只出现一次的数字", titleSlug: "single-number", difficulty: "Easy", tags: ["位运算", "数组"] },
  { problemId: 169, title: "多数元素", titleSlug: "majority-element", difficulty: "Easy", tags: ["数组", "哈希表", "分治", "计数", "排序"] },
  { problemId: 75, title: "颜色分类", titleSlug: "sort-colors", difficulty: "Medium", tags: ["数组", "双指针", "排序"] },
  { problemId: 31, title: "下一个排列", titleSlug: "next-permutation", difficulty: "Medium", tags: ["数组", "双指针"] },
  { problemId: 287, title: "寻找重复数", titleSlug: "find-the-duplicate-number", difficulty: "Medium", tags: ["位运算", "数组", "双指针", "二分查找"] },
];

const initializeProblems = async () => {
  const count = await LeetCodeProblem.countDocuments();
  if (count > 0) {
    return { message: "题目已初始化", count, initialized: false };
  }

  const problems = HOT_100_PROBLEMS.map((p, index) => ({
    ...p,
    order: index + 1,
  }));

  await LeetCodeProblem.insertMany(problems);
  return { message: "初始化成功", count: problems.length, initialized: true };
};

const getAllProblems = async (userId) => {
  const problems = await LeetCodeProblem.find().sort({ order: 1 }).lean();
  const progress = await LeetCodeProgress.find({ userId, solved: true }).lean();
  const solvedSet = new Set(progress.map((p) => p.problemId));

  return problems.map((p) => ({
    ...p,
    solved: solvedSet.has(p.problemId),
  }));
};

const toggleProblemSolved = async (userId, problemId) => {
  const existing = await LeetCodeProgress.findOne({ userId, problemId: parseInt(problemId) });

  if (existing) {
    existing.solved = !existing.solved;
    existing.solvedAt = existing.solved ? new Date() : null;
    await existing.save();
    return { solved: existing.solved };
  }

  const progress = await LeetCodeProgress.create({
    userId,
    problemId: parseInt(problemId),
    solved: true,
    solvedAt: new Date(),
  });
  return { solved: progress.solved };
};

const getUserProgress = async (userId) => {
  const total = await LeetCodeProblem.countDocuments();
  const solved = await LeetCodeProgress.countDocuments({ userId, solved: true });

  const easyTotal = await LeetCodeProblem.countDocuments({ difficulty: "Easy" });
  const mediumTotal = await LeetCodeProblem.countDocuments({ difficulty: "Medium" });
  const hardTotal = await LeetCodeProblem.countDocuments({ difficulty: "Hard" });

  const easyProblems = await LeetCodeProblem.find({ difficulty: "Easy" }).lean();
  const mediumProblems = await LeetCodeProblem.find({ difficulty: "Medium" }).lean();
  const hardProblems = await LeetCodeProblem.find({ difficulty: "Hard" }).lean();

  const easySolved = await LeetCodeProgress.countDocuments({
    userId,
    solved: true,
    problemId: { $in: easyProblems.map((p) => p.problemId) },
  });
  const mediumSolved = await LeetCodeProgress.countDocuments({
    userId,
    solved: true,
    problemId: { $in: mediumProblems.map((p) => p.problemId) },
  });
  const hardSolved = await LeetCodeProgress.countDocuments({
    userId,
    solved: true,
    problemId: { $in: hardProblems.map((p) => p.problemId) },
  });

  return {
    total,
    solved,
    percentage: total > 0 ? Math.round((solved / total) * 100) : 0,
    byDifficulty: {
      easy: { total: easyTotal, solved: easySolved },
      medium: { total: mediumTotal, solved: mediumSolved },
      hard: { total: hardTotal, solved: hardSolved },
    },
  };
};

const getFriendIds = async (userId) => {
  const conversations = await Conversation.find({
    members: userId,
    isGroup: false,
  }).populate("members", "_id");

  const friendIds = new Set();
  conversations.forEach((conv) => {
    conv.members.forEach((member) => {
      if (member._id.toString() !== userId) {
        friendIds.add(member._id.toString());
      }
    });
  });

  friendIds.add(userId);
  return Array.from(friendIds);
};

const getLeaderboard = async (userId) => {
  const friendIds = await getFriendIds(userId);

  const leaderboardData = await Promise.all(
    friendIds.map(async (id) => {
      const user = await User.findById(id).select("name profilePic").lean();
      const solved = await LeetCodeProgress.countDocuments({ userId: id, solved: true });
      return {
        _id: id,
        name: user?.name || "未知用户",
        profilePic: user?.profilePic,
        solved,
        isCurrentUser: id === userId,
      };
    })
  );

  return leaderboardData.sort((a, b) => b.solved - a.solved);
};

module.exports = {
  HOT_100_PROBLEMS,
  initializeProblems,
  getAllProblems,
  toggleProblemSolved,
  getUserProgress,
  getFriendIds,
  getLeaderboard,
};
