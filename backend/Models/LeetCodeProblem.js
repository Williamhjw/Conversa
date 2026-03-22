const mongoose = require("mongoose");

const LeetCodeProblemSchema = new mongoose.Schema(
  {
    problemId: {
      type: Number,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    titleSlug: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true,
    },
    tags: [
      {
        type: String,
      },
    ],
    order: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const LeetCodeProblem = mongoose.model("LeetCodeProblem", LeetCodeProblemSchema);
module.exports = LeetCodeProblem;
