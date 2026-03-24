const express = require("express");
const router = express.Router();
const {
    searchStock,
    getStockQuote,
    getBatchQuotes,
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    getStockHistory,
} = require("../Controllers/stock-controller.js");
const fetchUser = require("../middleware/fetchUser.js");

router.get("/search", searchStock);
router.get("/quote/:symbol", getStockQuote);
router.get("/batch", getBatchQuotes);
router.get("/watchlist", fetchUser, getWatchlist);
router.post("/watchlist", fetchUser, addToWatchlist);
router.delete("/watchlist/:symbol", fetchUser, removeFromWatchlist);
router.get("/history/:symbol", getStockHistory);

module.exports = router;
