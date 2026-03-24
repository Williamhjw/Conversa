const express = require("express");
const router = express.Router();
const { initProblems, getProblems, toggleSolved, getProgress, getLeaderboard } = require("../Controllers/leetcode-controller.js");
const fetchUser = require("../middleware/fetchUser.js");

router.post("/init", initProblems);
router.get("/problems", fetchUser, getProblems);
router.post("/problems/:problemId/toggle", fetchUser, toggleSolved);
router.get("/progress", fetchUser, getProgress);
router.get("/leaderboard", fetchUser, getLeaderboard);

module.exports = router;
