import { useEffect, useState, useCallback, useMemo } from "react"
import { 
    TrendingUp, TrendingDown, Search, Plus, Trash2, ArrowLeft, 
    Loader2, RefreshCw, X, BarChart3, Clock, DollarSign
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { API_BASE } from "@/lib/api"
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Area, AreaChart
} from "recharts"

interface StockData {
    symbol: string
    name: string
    currentPrice: number
    openPrice: number
    lastClose: number
    highPrice: number
    lowPrice: number
    volume: number
    turnover: number
    change: string
    changePercent: string
    isUp: boolean
    addedAt?: string
}

interface SearchResult {
    symbol: string
    name: string
    code: string
    market: string
    type: string
    price: number | null
}

interface HistoryData {
    date: string
    open: number
    close: number
    high: number
    low: number
    volume: number
}

type PeriodType = "day" | "week" | "month" | "3month" | "6month"

const PERIOD_LABELS: Record<PeriodType, string> = {
    day: "1天",
    week: "1周",
    month: "1月",
    "3month": "3月",
    "6month": "6月",
}

const formatVolume = (volume: number): string => {
    if (volume >= 100000000) {
        return `${(volume / 100000000).toFixed(2)}亿`
    }
    if (volume >= 10000) {
        return `${(volume / 10000).toFixed(2)}万`
    }
    return volume.toString()
}

const formatPrice = (price: number): string => {
    return price.toFixed(2)
}

export default function Stock() {
    const [watchlist, setWatchlist] = useState<StockData[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showSearch, setShowSearch] = useState(false)
    const [selectedStock, setSelectedStock] = useState<StockData | null>(null)
    const [historyData, setHistoryData] = useState<HistoryData[]>([])
    const [historyPeriod, setHistoryPeriod] = useState<PeriodType>("month")
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)

    const fetchWatchlist = useCallback(async () => {
        try {
            const token = localStorage.getItem("auth-token")
            const response = await fetch(`${API_BASE}/stock/watchlist`, {
                headers: {
                    "auth-token": token || "",
                },
            })
            const data = await response.json()
            if (response.ok) {
                setWatchlist(data.watchlist || [])
            }
        } catch (error) {
            console.error("Failed to fetch watchlist:", error)
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }, [])

    useEffect(() => {
        fetchWatchlist()
    }, [fetchWatchlist])

    const handleRefresh = () => {
        setIsRefreshing(true)
        fetchWatchlist()
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) return
        
        setIsSearching(true)
        try {
            const response = await fetch(`${API_BASE}/stock/search?keyword=${encodeURIComponent(searchQuery)}`)
            const data = await response.json()
            setSearchResults(data.stocks || [])
        } catch (error) {
            console.error("Search failed:", error)
        } finally {
            setIsSearching(false)
        }
    }

    const handleAddToWatchlist = async (stock: SearchResult) => {
        try {
            const token = localStorage.getItem("auth-token")
            const response = await fetch(`${API_BASE}/stock/watchlist`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "auth-token": token || "",
                },
                body: JSON.stringify({
                    symbol: stock.symbol,
                    name: stock.name,
                }),
            })
            const data = await response.json()
            if (response.ok) {
                setShowSearch(false)
                setSearchQuery("")
                setSearchResults([])
                fetchWatchlist()
            } else {
                alert(data.error || "添加失败")
            }
        } catch (error) {
            console.error("Failed to add to watchlist:", error)
            alert("添加失败，请重试")
        }
    }

    const handleRemoveFromWatchlist = async (symbol: string) => {
        try {
            const token = localStorage.getItem("auth-token")
            const response = await fetch(`${API_BASE}/stock/watchlist/${symbol}`, {
                method: "DELETE",
                headers: {
                    "auth-token": token || "",
                },
            })
            if (response.ok) {
                setWatchlist(watchlist.filter(s => s.symbol !== symbol))
            }
        } catch (error) {
            console.error("Failed to remove from watchlist:", error)
        }
    }

    const fetchStockHistory = async (symbol: string, period: PeriodType) => {
        setIsLoadingHistory(true)
        try {
            const response = await fetch(`${API_BASE}/stock/history/${symbol}?period=${period}`)
            const data = await response.json()
            if (response.ok) {
                setHistoryData(data.history || [])
                setHistoryPeriod(period)
            }
        } catch (error) {
            console.error("Failed to fetch history:", error)
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const handleSelectStock = (stock: StockData) => {
        setSelectedStock(stock)
        fetchStockHistory(stock.symbol, "month")
    }

    const handlePeriodChange = (period: PeriodType) => {
        if (selectedStock) {
            fetchStockHistory(selectedStock.symbol, period)
        }
    }

    const chartData = useMemo(() => {
        return historyData.map(item => ({
            date: item.date,
            price: item.close,
            open: item.open,
            high: item.high,
            low: item.low,
        }))
    }, [historyData])

    const priceDomain = useMemo(() => {
        if (chartData.length === 0) return [0, 100]
        const prices = chartData.map(d => d.price).filter(p => p > 0)
        if (prices.length === 0) return [0, 100]
        const min = Math.min(...prices)
        const max = Math.max(...prices)
        const padding = (max - min) * 0.1 || 1
        return [Math.floor(min - padding), Math.ceil(max + padding)]
    }, [chartData])

    if (selectedStock) {
        return (
            <div className="flex flex-col h-full bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                <div className="flex items-center justify-between p-4 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedStock(null)}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-lg font-bold">{selectedStock.name}</h1>
                            <p className="text-sm text-muted-foreground">{selectedStock.symbol}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "text-2xl font-bold",
                            selectedStock.isUp ? "text-red-500" : "text-green-500"
                        )}>
                            {formatPrice(selectedStock.currentPrice)}
                        </span>
                        <div className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
                            selectedStock.isUp 
                                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" 
                                : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        )}>
                            {selectedStock.isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            <span>{selectedStock.changePercent}%</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <Card className="shadow-lg border-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">价格走势</CardTitle>
                                <div className="flex gap-1">
                                    {(Object.keys(PERIOD_LABELS) as PeriodType[]).map((period) => (
                                        <Button
                                            key={period}
                                            variant={historyPeriod === period ? "default" : "outline"}
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => handlePeriodChange(period)}
                                        >
                                            {PERIOD_LABELS[period]}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingHistory ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : chartData.length > 0 ? (
                                <div className="h-64 md:h-80 w-full overflow-hidden">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                            <defs>
                                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={selectedStock.isUp ? "#ef4444" : "#22c55e"} stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor={selectedStock.isUp ? "#ef4444" : "#22c55e"} stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis 
                                                dataKey="date" 
                                                tick={{ fontSize: 11 }}
                                                className="text-muted-foreground"
                                                tickFormatter={(value) => value.slice(5)}
                                            />
                                            <YAxis 
                                                domain={priceDomain}
                                                tick={{ fontSize: 10 }}
                                                className="text-muted-foreground"
                                                tickFormatter={(value) => value.toFixed(2)}
                                                width={45}
                                                axisLine={false}
                                            />
                                            <Tooltip 
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--card))',
                                                    border: '1px solid hsl(var(--border))',
                                                    borderRadius: '8px',
                                                }}
                                                formatter={(value: number) => [value.toFixed(2), '价格']}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="price" 
                                                stroke={selectedStock.isUp ? "#ef4444" : "#22c55e"}
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorPrice)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-64 text-muted-foreground">
                                    暂无历史数据
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="shadow-sm border-0 bg-white/90 dark:bg-slate-900/90">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <DollarSign className="h-4 w-4" />
                                    <span className="text-xs">开盘价</span>
                                </div>
                                <p className="text-lg font-semibold">{formatPrice(selectedStock.openPrice)}</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-0 bg-white/90 dark:bg-slate-900/90">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-xs">最高价</span>
                                </div>
                                <p className="text-lg font-semibold text-red-500">{formatPrice(selectedStock.highPrice)}</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-0 bg-white/90 dark:bg-slate-900/90">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <TrendingDown className="h-4 w-4" />
                                    <span className="text-xs">最低价</span>
                                </div>
                                <p className="text-lg font-semibold text-green-500">{formatPrice(selectedStock.lowPrice)}</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-0 bg-white/90 dark:bg-slate-900/90">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Clock className="h-4 w-4" />
                                    <span className="text-xs">昨收</span>
                                </div>
                                <p className="text-lg font-semibold">{formatPrice(selectedStock.lastClose)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm border-0 bg-white/90 dark:bg-slate-900/90">
                        <CardContent className="p-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-muted-foreground">成交量</span>
                                    <p className="text-base font-medium">{formatVolume(selectedStock.volume)}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">成交额</span>
                                    <p className="text-base font-medium">{formatVolume(selectedStock.turnover)}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">涨跌额</span>
                                    <p className={cn(
                                        "text-base font-medium",
                                        selectedStock.isUp ? "text-red-500" : "text-green-500"
                                    )}>
                                        {selectedStock.change}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">涨跌幅</span>
                                    <p className={cn(
                                        "text-base font-medium",
                                        selectedStock.isUp ? "text-red-500" : "text-green-500"
                                    )}>
                                        {selectedStock.changePercent}%
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="flex items-center justify-between p-4 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h1 className="text-lg font-bold">股票行情</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                    </Button>
                    <Button onClick={() => setShowSearch(true)} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        添加
                    </Button>
                </div>
            </div>

            {showSearch && (
                <div className="p-4 border-b bg-white dark:bg-slate-900">
                    <div className="flex gap-2 mb-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索股票代码或名称..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                className="pl-9"
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={isSearching}>
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "搜索"}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                            setShowSearch(false)
                            setSearchQuery("")
                            setSearchResults([])
                        }}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    {searchResults.length > 0 && (
                        <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border bg-muted/30">
                            {searchResults.map((stock) => (
                                <div
                                    key={stock.symbol}
                                    className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                                    onClick={() => handleAddToWatchlist(stock)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium truncate">{stock.name}</p>
                                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                {stock.market}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {stock.symbol}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {stock.price !== null && (
                                            <span className="text-lg font-semibold text-primary">
                                                {formatPrice(stock.price)}
                                            </span>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleAddToWatchlist(stock)
                                            }}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : watchlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-lg font-medium">暂无关注的股票</p>
                        <p className="text-sm mt-1">点击上方"添加"按钮搜索并关注股票</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {watchlist.map((stock) => (
                            <Card 
                                key={stock.symbol}
                                className="shadow-sm border-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                                onClick={() => handleSelectStock(stock)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold truncate">{stock.name}</p>
                                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                    {stock.symbol}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                成交量: {formatVolume(stock.volume)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className={cn(
                                                    "text-xl font-bold",
                                                    stock.isUp ? "text-red-500" : "text-green-500"
                                                )}>
                                                    {formatPrice(stock.currentPrice)}
                                                </p>
                                                <div className={cn(
                                                    "flex items-center justify-end gap-1 text-sm",
                                                    stock.isUp ? "text-red-500" : "text-green-500"
                                                )}>
                                                    {stock.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    <span>{stock.changePercent}%</span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleRemoveFromWatchlist(stock.symbol)
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
