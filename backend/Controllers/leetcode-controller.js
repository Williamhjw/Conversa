const {
  initializeProblems,
  getAllProblems,
  toggleProblemSolved,
  getUserProgress,
  getLeaderboard,
} = require("../Services/leetcode-service.js");

const initProblemsHandler = async (req, res) => {
  try {
    const result = await initializeProblems();
    res.json(result);
  } catch (error) {
    console.error("初始化题目失败:", error);
    res.status(500).json({ error: "初始化失败" });
  }
};

const getProblemsHandler = async (req, res) => {
  try {
    const problems = await getAllProblems(req.user.id);
    res.json(problems);
  } catch (error) {
    console.error("获取题目失败:", error);
    res.status(500).json({ error: "获取题目失败" });
  }
};

const toggleSolvedHandler = async (req, res) => {
  try {
    const { problemId } = req.params;
    const result = await toggleProblemSolved(req.user.id, problemId);
    res.json(result);
  } catch (error) {
    console.error("更新状态失败:", error);
    res.status(500).json({ error: "更新状态失败" });
  }
};

const getProgressHandler = async (req, res) => {
  try {
    const progress = await getUserProgress(req.user.id);
    res.json(progress);
  } catch (error) {
    console.error("获取进度失败:", error);
    res.status(500).json({ error: "获取进度失败" });
  }
};

const getLeaderboardHandler = async (req, res) => {
  try {
    const leaderboard = await getLeaderboard(req.user.id);
    res.json(leaderboard);
  } catch (error) {
    console.error("获取排行榜失败:", error);
    res.status(500).json({ error: "获取排行榜失败" });
  }
};

module.exports = {
  initProblems: initProblemsHandler,
  getProblems: getProblemsHandler,
  toggleSolved: toggleSolvedHandler,
  getProgress: getProgressHandler,
  getLeaderboard: getLeaderboardHandler,
};
