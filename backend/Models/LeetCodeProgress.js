const mongoose = require("mongoose");

const LeetCodeProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    problemId: {
      type: Number,
      required: true,
    },
    solved: {
      type: Boolean,
      default: false,
    },
    solvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

LeetCodeProgressSchema.index({ userId: 1, problemId: 1 }, { unique: true });

const LeetCodeProgress = mongoose.model("LeetCodeProgress", LeetCodeProgressSchema);
module.exports = LeetCodeProgress;
