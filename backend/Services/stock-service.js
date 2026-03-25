const axios = require("axios");
const iconv = require("iconv-lite");
const User = require("../Models/User.js");

const SINA_API_BASE = "https://hq.sinajs.cn";

const parseStockData = (data) => {
  if (!data || data === '""') return null;

  const parts = data.split(",");
  if (parts.length < 32) return null;

  const name = parts[0].replace(/"/g, "");
  const openPrice = parseFloat(parts[1]);
  const lastClose = parseFloat(parts[2]);
  const currentPrice = parseFloat(parts[3]);
  const highPrice = parseFloat(parts[4]);
  const lowPrice = parseFloat(parts[5]);
  const volume = parseInt(parts[8]);
  const turnover = parseFloat(parts[9]);
  const date = parts[30];
  const time = parts[31];

  const change = currentPrice - lastClose;
  const changePercent = lastClose > 0 ? ((change / lastClose) * 100).toFixed(2) : 0;

  return {
    name,
    openPrice,
    lastClose,
    currentPrice,
    highPrice,
    lowPrice,
    volume,
    turnover,
    date,
    time,
    change: change.toFixed(2),
    changePercent,
    isUp: change >= 0,
  };
};

const decodeGbkResponse = (data) => {
  return iconv.decode(Buffer.from(data), "gbk");
};

const fetchStockQuotes = async (symbols) => {
  const formattedSymbols = symbols.map((s) => s.toLowerCase()).join(",");
  const url = `${SINA_API_BASE}/list=${formattedSymbols}`;

  const response = await axios.get(url, {
    headers: {
      Referer: "https://finance.sina.com.cn",
    },
    responseType: "arraybuffer",
  });

  const data = decodeGbkResponse(response.data);
  const lines = data.split("\n").filter((line) => line.trim());

  const stockDataMap = {};
  lines.forEach((line) => {
    const symbolMatch = line.match(/var hq_str_(\w+)=/);
    const dataMatch = line.match(/="(.+)"/);

    if (symbolMatch && dataMatch) {
      const symbol = symbolMatch[1].toUpperCase();
      const stockData = parseStockData(dataMatch[1]);
      if (stockData) {
        stockDataMap[symbol] = stockData;
      }
    }
  });

  return stockDataMap;
};

const searchStocks = async (keyword) => {
  const searchUrl = `https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&key=${encodeURIComponent(keyword)}&name=suggestdata`;

  const response = await axios.get(searchUrl, {
    headers: {
      Referer: "https://finance.sina.com.cn",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    responseType: "arraybuffer",
  });

  const dataStr = decodeGbkResponse(response.data);

  if (!dataStr || dataStr.includes('""')) {
    return [];
  }

  const match = dataStr.match(/="([^"]+)"/);
  if (!match || !match[1]) {
    return [];
  }

  const items = match[1].split(";");

  const stocks = items
    .filter((item) => item && item.includes(","))
    .map((item) => {
      const parts = item.split(",");
      if (parts.length >= 4) {
        const name = parts[0];
        const type = parts[1];
        const code = parts[2];
        const marketCode = parts[3];

        let market = "未知";
        let finalSymbol = marketCode.toLowerCase();

        if (marketCode.startsWith("sh")) {
          market = "上海";
        } else if (marketCode.startsWith("sz")) {
          market = "深圳";
        } else if (marketCode.startsWith("hk")) {
          market = "港股";
        }

        if (!name || name.length > 20 || !finalSymbol) {
          return null;
        }

        return {
          code,
          name,
          type,
          symbol: finalSymbol.toUpperCase(),
          market,
          price: null,
        };
      }
      return null;
    })
    .filter((stock) => stock !== null)
    .slice(0, 10);

  return stocks;
};

const enrichStocksWithPrices = async (stocks) => {
  if (stocks.length === 0) return stocks;

  const symbols = stocks.map((s) => s.symbol.toLowerCase()).join(",");

  try {
    const priceMap = await fetchStockQuotes(symbols.split(","));
    stocks.forEach((stock) => {
      stock.price = priceMap[stock.symbol]?.currentPrice || null;
    });
  } catch (error) {
    console.error("Failed to fetch quotes:", error.message);
  }

  return stocks;
};

const getStockQuote = async (symbol) => {
  const priceMap = await fetchStockQuotes([symbol]);
  const stockData = priceMap[symbol.toUpperCase()];

  if (!stockData) {
    return null;
  }

  return {
    symbol: symbol.toUpperCase(),
    ...stockData,
  };
};

const getBatchQuotes = async (symbols) => {
  if (!symbols || symbols.length === 0) {
    return [];
  }

  const priceMap = await fetchStockQuotes(symbols);

  return Object.entries(priceMap).map(([symbol, data]) => ({
    symbol,
    ...data,
  }));
};

const getUserWatchlist = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return { error: "用户不存在", status: 404 };
  }

  const watchlist = user.watchlist || [];
  if (watchlist.length === 0) {
    return { watchlist: [] };
  }

  const symbols = watchlist.map((item) => item.symbol);
  const priceMap = await fetchStockQuotes(symbols);

  const result = watchlist.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    addedAt: item.addedAt,
    ...priceMap[item.symbol],
  }));

  return { watchlist: result };
};

const addToWatchlist = async (userId, symbol, name) => {
  const user = await User.findById(userId);
  if (!user) {
    return { error: "用户不存在", status: 404 };
  }

  const exists = user.watchlist.some((item) => item.symbol === symbol);
  if (exists) {
    return { error: "该股票已在关注列表中", status: 400 };
  }

  user.watchlist.push({ symbol, name });
  await user.save();

  return { message: "添加成功", watchlist: user.watchlist };
};

const removeFromWatchlist = async (userId, symbol) => {
  const user = await User.findById(userId);
  if (!user) {
    return { error: "用户不存在", status: 404 };
  }

  user.watchlist = user.watchlist.filter((item) => item.symbol !== symbol);
  await user.save();

  return { message: "移除成功", watchlist: user.watchlist };
};

const getStockHistory = async (symbol, period = "day") => {
  let days = 30;
  switch (period) {
    case "day":
      days = 1;
      break;
    case "week":
      days = 7;
      break;
    case "month":
      days = 30;
      break;
    case "3month":
      days = 90;
      break;
    case "6month":
      days = 180;
      break;
    default:
      days = 30;
  }

  const code = symbol.toLowerCase().replace(/^(sh|sz)/, "");
  const market = symbol.toLowerCase().startsWith("sh") ? "sh" : "sz";

  const url = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${market}${code}&scale=240&ma=no&datalen=${Math.min(days + 10, 500)}`;

  const response = await axios.get(url, {
    headers: {
      Referer: "https://finance.sina.com.cn",
    },
  });

  let data = response.data || [];
  if (!Array.isArray(data)) {
    return { history: [], period };
  }

  data = data.slice(-days);

  const history = data.map((item) => ({
    date: item.day,
    open: parseFloat(item.open),
    close: parseFloat(item.close),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    volume: parseInt(item.volume),
  }));

  return { history, period };
};

module.exports = {
  parseStockData,
  decodeGbkResponse,
  fetchStockQuotes,
  searchStocks,
  enrichStocksWithPrices,
  getStockQuote,
  getBatchQuotes,
  getUserWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getStockHistory,
};
