const {
  searchStocks,
  enrichStocksWithPrices,
  getStockQuote,
  getBatchQuotes,
  getUserWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getStockHistory,
} = require("../Services/stock-service.js");

const searchStockHandler = async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.length < 1) {
      return res.status(400).json({ error: "请输入搜索关键词" });
    }

    let stocks = await searchStocks(keyword);
    stocks = await enrichStocksWithPrices(stocks);

    res.json({ stocks });
  } catch (error) {
    console.error("Search stock error:", error.message);
    res.status(500).json({ error: "搜索股票失败: " + error.message });
  }
};

const getStockQuoteHandler = async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({ error: "请提供股票代码" });
    }

    const stockData = await getStockQuote(symbol);

    if (!stockData) {
      return res.status(404).json({ error: "未找到该股票" });
    }

    res.json(stockData);
  } catch (error) {
    console.error("Get stock quote error:", error.message);
    res.status(500).json({ error: "获取股票数据失败" });
  }
};

const getBatchQuotesHandler = async (req, res) => {
  try {
    const { symbols } = req.query;

    if (!symbols) {
      return res.json({ stocks: [] });
    }

    const symbolList = symbols.split(",").filter((s) => s);

    if (symbolList.length === 0) {
      return res.json({ stocks: [] });
    }

    const stocks = await getBatchQuotes(symbolList);
    res.json({ stocks });
  } catch (error) {
    console.error("Get batch quotes error:", error.message);
    res.status(500).json({ error: "获取股票数据失败" });
  }
};

const getWatchlistHandler = async (req, res) => {
  try {
    const result = await getUserWatchlist(req.user.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error("Get watchlist error:", error.message);
    res.status(500).json({ error: "获取关注列表失败" });
  }
};

const addToWatchlistHandler = async (req, res) => {
  try {
    const { symbol, name } = req.body;

    if (!symbol || !name) {
      return res.status(400).json({ error: "请提供股票代码和名称" });
    }

    const result = await addToWatchlist(req.user.id, symbol, name);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Add to watchlist error:", error.message);
    res.status(500).json({ error: "添加关注失败" });
  }
};

const removeFromWatchlistHandler = async (req, res) => {
  try {
    const { symbol } = req.params;

    const result = await removeFromWatchlist(req.user.id, symbol);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Remove from watchlist error:", error.message);
    res.status(500).json({ error: "移除关注失败" });
  }
};

const getStockHistoryHandler = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = "day" } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: "请提供股票代码" });
    }

    const result = await getStockHistory(symbol, period);
    res.json(result);
  } catch (error) {
    console.error("Get stock history error:", error.message);
    res.status(500).json({ error: "获取历史数据失败" });
  }
};

module.exports = {
  searchStock: searchStockHandler,
  getStockQuote: getStockQuoteHandler,
  getBatchQuotes: getBatchQuotesHandler,
  getWatchlist: getWatchlistHandler,
  addToWatchlist: addToWatchlistHandler,
  removeFromWatchlist: removeFromWatchlistHandler,
  getStockHistory: getStockHistoryHandler,
};
