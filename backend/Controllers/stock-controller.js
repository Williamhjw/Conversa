const axios = require("axios");
const User = require("../Models/User.js");

const SINA_API_BASE = "https://hq.sinajs.cn";
const SINA_LIST_API = "https://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData";

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

const searchStock = async (req, res) => {
    try {
        const { keyword } = req.query;
        
        if (!keyword || keyword.length < 1) {
            return res.status(400).json({ error: "请输入搜索关键词" });
        }

        const searchUrl = `https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&key=${encodeURIComponent(keyword)}&name=suggestdata`;
        
        const response = await axios.get(searchUrl, {
            headers: {
                "Referer": "https://finance.sina.com.cn",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            responseType: "arraybuffer",
        });

        const dataBuffer = response.data;
        const iconv = require("iconv-lite");
        const dataStr = iconv.decode(Buffer.from(dataBuffer), "gbk");

        if (!dataStr || dataStr.includes('""')) {
            return res.json({ stocks: [] });
        }

        const match = dataStr.match(/="([^"]+)"/);

        if (!match || !match[1]) {
            return res.json({ stocks: [] });
        }

        const items = match[1].split(";");

        const stocks = items
            .filter(item => item && item.includes(","))
            .map(item => {
                const parts = item.split(",");
                if (parts.length >= 4) {
                    // 新浪财经搜索API返回的数据格式：股票名称,类型,股票代码,市场代码
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
                        code: code,
                        name: name,
                        type: type,
                        symbol: finalSymbol.toUpperCase(),
                        market: market,
                        price: null,
                    };
                }
                return null;
            })
            .filter(stock => stock !== null)
            .slice(0, 10);

        if (stocks.length > 0) {
            const symbols = stocks.map(s => s.symbol.toLowerCase()).join(",");
            const quoteUrl = `${SINA_API_BASE}/list=${symbols}`;
            
            try {
                const quoteResponse = await axios.get(quoteUrl, {
                    headers: {
                        "Referer": "https://finance.sina.com.cn",
                    },
                    responseType: "arraybuffer",
                    timeout: 5000,
                });

                const iconv = require("iconv-lite");
                const quoteData = iconv.decode(Buffer.from(quoteResponse.data), "gbk");
                const lines = quoteData.split("\n").filter((line) => line.trim());
                
                const priceMap = {};
                lines.forEach((line) => {
                    const symbolMatch = line.match(/var hq_str_(\w+)=/);
                    const dataMatch = line.match(/="(.+)"/);
                    
                    if (symbolMatch && dataMatch) {
                        const sym = symbolMatch[1].toUpperCase();
                        const stockData = parseStockData(dataMatch[1]);
                        if (stockData) {
                            priceMap[sym] = stockData.currentPrice;
                        }
                    }
                });

                stocks.forEach(stock => {
                    stock.price = priceMap[stock.symbol] || null;
                });
            } catch (quoteError) {
                console.error("Failed to fetch quotes:", quoteError.message);
            }
        }

        res.json({ stocks });
    } catch (error) {
        console.error("Search stock error:", error.message);
        res.status(500).json({ error: "搜索股票失败: " + error.message });
    }
};

const getStockQuote = async (req, res) => {
    try {
        const { symbol } = req.params;
        
        if (!symbol) {
            return res.status(400).json({ error: "请提供股票代码" });
        }

        const formattedSymbol = symbol.toLowerCase();
        const url = `${SINA_API_BASE}/list=${formattedSymbol}`;
        
        const response = await axios.get(url, {
            headers: {
                "Referer": "https://finance.sina.com.cn",
            },
            responseType: "arraybuffer",
        });

        const iconv = require("iconv-lite");
        const data = iconv.decode(Buffer.from(response.data), "gbk");
        const match = data.match(/="(.+)"/);
        
        if (!match || !match[1]) {
            return res.status(404).json({ error: "未找到该股票" });
        }

        const stockData = parseStockData(match[1]);
        
        if (!stockData) {
            return res.status(404).json({ error: "股票数据解析失败" });
        }

        res.json({ 
            symbol: symbol.toUpperCase(),
            ...stockData 
        });
    } catch (error) {
        console.error("Get stock quote error:", error.message);
        res.status(500).json({ error: "获取股票数据失败" });
    }
};

const getBatchQuotes = async (req, res) => {
    try {
        const { symbols } = req.query;
        
        if (!symbols) {
            return res.json({ stocks: [] });
        }

        const symbolList = symbols.split(",").filter((s) => s);
        
        if (symbolList.length === 0) {
            return res.json({ stocks: [] });
        }

        const formattedSymbols = symbolList.map((s) => s.toLowerCase()).join(",");
        const url = `${SINA_API_BASE}/list=${formattedSymbols}`;
        
        const response = await axios.get(url, {
            headers: {
                "Referer": "https://finance.sina.com.cn",
            },
            responseType: "arraybuffer",
        });

        const iconv = require("iconv-lite");
        const data = iconv.decode(Buffer.from(response.data), "gbk");
        const lines = data.split("\n").filter((line) => line.trim());
        
        const stocks = lines.map((line) => {
            const symbolMatch = line.match(/var hq_str_(\w+)=/);
            const dataMatch = line.match(/="(.+)"/);
            
            if (symbolMatch && dataMatch) {
                const symbol = symbolMatch[1].toUpperCase();
                const stockData = parseStockData(dataMatch[1]);
                
                if (stockData) {
                    return {
                        symbol,
                        ...stockData,
                    };
                }
            }
            return null;
        }).filter((stock) => stock !== null);

        res.json({ stocks });
    } catch (error) {
        console.error("Get batch quotes error:", error.message);
        res.status(500).json({ error: "获取股票数据失败" });
    }
};

const getWatchlist = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: "用户不存在" });
        }

        const watchlist = user.watchlist || [];
        
        if (watchlist.length === 0) {
            return res.json({ watchlist: [] });
        }

        const symbols = watchlist.map((item) => item.symbol).join(",");
        const formattedSymbols = watchlist.map((item) => item.symbol.toLowerCase()).join(",");
        const url = `${SINA_API_BASE}/list=${formattedSymbols}`;
        
        const response = await axios.get(url, {
            headers: {
                "Referer": "https://finance.sina.com.cn",
            },
            responseType: "arraybuffer",
        });

        const iconv = require("iconv-lite");
        const data = iconv.decode(Buffer.from(response.data), "gbk");
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

        const result = watchlist.map((item) => ({
            symbol: item.symbol,
            name: item.name,
            addedAt: item.addedAt,
            ...stockDataMap[item.symbol],
        }));

        res.json({ watchlist: result });
    } catch (error) {
        console.error("Get watchlist error:", error.message);
        res.status(500).json({ error: "获取关注列表失败" });
    }
};

const addToWatchlist = async (req, res) => {
    try {
        const { symbol, name } = req.body;
        
        if (!symbol || !name) {
            return res.status(400).json({ error: "请提供股票代码和名称" });
        }

        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: "用户不存在" });
        }

        const exists = user.watchlist.some((item) => item.symbol === symbol);
        
        if (exists) {
            return res.status(400).json({ error: "该股票已在关注列表中" });
        }

        user.watchlist.push({ symbol, name });
        await user.save();

        res.json({ 
            message: "添加成功",
            watchlist: user.watchlist 
        });
    } catch (error) {
        console.error("Add to watchlist error:", error.message);
        res.status(500).json({ error: "添加关注失败" });
    }
};

const removeFromWatchlist = async (req, res) => {
    try {
        const { symbol } = req.params;
        
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: "用户不存在" });
        }

        user.watchlist = user.watchlist.filter((item) => item.symbol !== symbol);
        await user.save();

        res.json({ 
            message: "移除成功",
            watchlist: user.watchlist 
        });
    } catch (error) {
        console.error("Remove from watchlist error:", error.message);
        res.status(500).json({ error: "移除关注失败" });
    }
};

const getStockHistory = async (req, res) => {
    try {
        const { symbol } = req.params;
        const { period = "day" } = req.query;
        
        if (!symbol) {
            return res.status(400).json({ error: "请提供股票代码" });
        }

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
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days - 10);

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        const url = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${market}${code}&scale=240&ma=no&datalen=${Math.min(days + 10, 500)}`;
        
        const response = await axios.get(url, {
            headers: {
                "Referer": "https://finance.sina.com.cn",
            },
        });

        let data = response.data || [];
        
        if (!Array.isArray(data)) {
            return res.json({ history: [], period });
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

        res.json({ history, period });
    } catch (error) {
        console.error("Get stock history error:", error.message);
        res.status(500).json({ error: "获取历史数据失败" });
    }
};

module.exports = {
    searchStock,
    getStockQuote,
    getBatchQuotes,
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    getStockHistory,
};
