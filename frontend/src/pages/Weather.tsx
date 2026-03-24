import { useEffect, useState, useCallback } from "react"
import { Car, Droplets, Loader2, MapPin, RefreshCw, Shirt, Sun, Thermometer, Umbrella, Wind, Eye, Gauge } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { API_BASE } from "@/lib/api"

interface WeatherData {
    location: string
    temperature: number
    feelsLike: number
    humidity: number
    windSpeed: number
    description: string
    icon: string
    visibility: number
    pressure: number
}

interface AISuggestion {
    clothing: string
    travel: string
}

const WEATHER_ICONS: Record<string, string> = {
    // 晴
    "晴": "☀️",
    "晴间多云": "🌤️",
    "晴转多云": "🌤️",
    "多云转晴": "🌤️",
    // 多云
    "多云": "⛅",
    "阴": "☁️",
    "阴天": "☁️",
    "阴转多云": "☁️",
    "多云转阴": "☁️",
    // 雨
    "阵雨": "🌦️",
    "雷阵雨": "⛈️",
    "小雨": "🌧️",
    "中雨": "🌧️",
    "大雨": "🌧️",
    "暴雨": "⛈️",
    "大暴雨": "⛈️",
    "特大暴雨": "⛈️",
    "冻雨": "🌨️",
    // 雪
    "小雪": "❄️",
    "中雪": "❄️",
    "大雪": "❄️",
    "暴雪": "❄️",
    "雨夹雪": "🌨️",
    // 雾/霾
    "雾": "🌫️",
    "大雾": "🌫️",
    "霾": "😷",
    "轻度霾": "😷",
    "中度霾": "😷",
    "重度霾": "😷",
    // 沙尘
    "沙尘暴": "�️",
    "强沙尘暴": "🌪️",
    "浮尘": "🌫️",
    "扬沙": "🌫️",
    // 其他
    "冰雹": "🧊",
    "龙卷风": "🌪️",
}

const getWeatherIcon = (description: string): string => {
    // 精确匹配优先
    if (WEATHER_ICONS[description]) {
        return WEATHER_ICONS[description];
    }
    
    // 部分匹配
    for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
        if (description.includes(key)) {
            return icon;
        }
    }
    
    // 关键词匹配
    if (description.includes("晴")) return "☀️";
    if (description.includes("雨")) return "🌧️";
    if (description.includes("雪")) return "❄️";
    if (description.includes("云")) return "☁️";
    if (description.includes("雾") || description.includes("霾")) return "🌫️";
    if (description.includes("沙") || description.includes("尘")) return "🌫️";
    
    return "🌤️";
}

// Format suggestion text by removing markdown and structuring content
const formatSuggestion = (text: string): React.ReactElement => {
    if (!text) return <p className="text-sm text-slate-400">暂无建议</p>;

    // Remove markdown bold syntax
    const cleanText = text.replace(/\*\*/g, "");

    // Split by double newlines to get sections
    const sections = cleanText.split("\n\n").filter(Boolean);

    return (
        <div className="space-y-3">
            {sections.map((section, index) => {
                const lines = section.split("\n").filter(Boolean);
                if (lines.length === 0) return null;

                // Check if first line is a title (ends with : or ：)
                const firstLine = lines[0];
                const isTitle = firstLine.match(/[:：]$/);

                if (isTitle && lines.length > 1) {
                    return (
                        <div key={index} className="border-l-2 border-purple-300 dark:border-purple-700 pl-3">
                            <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">
                                {firstLine.replace(/[:：]$/, "")}
                            </h4>
                            <div className="space-y-1">
                                {lines.slice(1).map((line, i) => (
                                    <p key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {line.replace(/^[-•]\s*/, "")}
                                    </p>
                                ))}
                            </div>
                        </div>
                    );
                }

                // Regular paragraph
                return (
                    <p key={index} className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {firstLine}
                    </p>
                );
            })}
        </div>
    );
}

const fetchLocationByIP = async (): Promise<{ lat: number; lon: number }> => {
    // 使用 HTTPS 的 IP 定位服务
    try {
        const res = await fetch("https://ipapi.co/json/")
        const data = await res.json()
        if (data.latitude && data.longitude) {
            return { lat: data.latitude, lon: data.longitude }
        }
    } catch {
        // 备用方案
        try {
            const res = await fetch("https://geolocation-db.com/json/")
            const data = await res.json()
            if (data.latitude && data.longitude) {
                return { lat: data.latitude, lon: data.longitude }
            }
        } catch {
            // 忽略错误
        }
    }
    throw new Error("IP定位失败")
}

export default function Weather() {
    const [weather, setWeather] = useState<WeatherData | null>(null)
    const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
    const [loading, setLoading] = useState(true)
    const [suggestionLoading, setSuggestionLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [locationMethod, setLocationMethod] = useState<"gps" | "ip" | null>(null)

    const fetchWeather = useCallback(async (lat: number, lon: number) => {
        try {
            setLoading(true)
            setError(null)
            const res = await fetch(`${API_BASE}/weather?lat=${lat}&lon=${lon}`)
            if (!res.ok) throw new Error("获取天气失败")
            const data = await res.json()
            setWeather(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : "获取天气失败")
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchSuggestion = useCallback(async (weatherData: WeatherData) => {
        try {
            setSuggestionLoading(true)
            const res = await fetch(`${API_BASE}/weather/suggestion`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    temperature: weatherData.temperature,
                    feelsLike: weatherData.feelsLike,
                    humidity: weatherData.humidity,
                    windSpeed: weatherData.windSpeed,
                    description: weatherData.description,
                    location: weatherData.location,
                }),
            })
            if (!res.ok) throw new Error("获取建议失败")
            const data = await res.json()
            setSuggestion(data)
        } catch {
            setSuggestion(null)
        } finally {
            setSuggestionLoading(false)
        }
    }, [])

    const handleRefresh = useCallback(() => {
        // IP 定位备用方案
        const useIPFallback = async () => {
            try {
                setLocationMethod("ip")
                const ipLocation = await fetchLocationByIP()
                fetchWeather(ipLocation.lat, ipLocation.lon)
            } catch {
                setError("无法获取位置信息，请检查网络连接")
                setLoading(false)
            }
        }

        const getLocation = () => {
            // 检查是否支持地理位置 API
            if (!navigator.geolocation) {
                console.log("浏览器不支持地理位置 API，使用 IP 定位")
                useIPFallback()
                return
            }

            // 检查是否是 HTTPS（地理位置 API 需要 HTTPS）
            const isHTTPS = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
            
            if (!isHTTPS) {
                console.log("非 HTTPS 环境，使用 IP 定位")
                useIPFallback()
                return
            }

            // 尝试 GPS 定位
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log("GPS 定位成功")
                    setLocationMethod("gps")
                    fetchWeather(position.coords.latitude, position.coords.longitude)
                },
                (error) => {
                    console.log("GPS 定位失败:", error.message)
                    useIPFallback()
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                }
            )
        }

        getLocation()
    }, [fetchWeather])

    useEffect(() => {
        handleRefresh()
    }, [handleRefresh])

    useEffect(() => {
        if (weather) {
            fetchSuggestion(weather)
        }
    }, [weather, fetchSuggestion])

    if (loading) {
        return (
            <div className="h-full flex flex-col overflow-hidden bg-linear-to-br from-sky-50 to-blue-100 dark:from-slate-900 dark:to-slate-800">
                <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm">
                            <Sun className="size-6 text-amber-500" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">天气预报</h1>
                    </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping" />
                            <Loader2 className="size-10 animate-spin text-blue-500 relative" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">正在获取天气信息...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error && !weather) {
        return (
            <div className="h-full flex flex-col overflow-hidden bg-linear-to-br from-sky-50 to-blue-100 dark:from-slate-900 dark:to-slate-800">
                <div className="flex items-center gap-3 px-6 py-4 max-w-7xl mx-auto w-full">
                    <div className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm">
                        <Sun className="size-6 text-amber-500" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">天气预报</h1>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
                    <div className="p-6 bg-white/60 dark:bg-slate-800/60 rounded-3xl shadow-lg">
                        <Umbrella className="size-16 text-slate-400" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-center max-w-md font-medium">{error}</p>
                    <Button onClick={handleRefresh} disabled={loading} className="rounded-full px-6 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        重试
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-linear-to-br from-sky-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/80 dark:bg-slate-800/80 rounded-xl shadow-sm backdrop-blur-sm">
                        <Sun className="size-5 text-amber-500" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">天气预报</h1>
                </div>
                <div className="flex items-center gap-2">
                    {locationMethod === "ip" && (
                        <span className="text-xs font-medium text-slate-500 bg-white/60 dark:bg-slate-800/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
                            IP定位
                        </span>
                    )}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleRefresh}
                        disabled={loading}
                        className="rounded-full hover:bg-white/60 dark:hover:bg-slate-800/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`size-4 text-slate-600 dark:text-slate-300 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-6">
                <div className="max-w-7xl mx-auto">
                    {weather && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column - Main Weather */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Main Weather Card */}
                                <Card className="overflow-hidden border-0 shadow-2xl bg-linear-to-br from-blue-400 via-blue-500 to-indigo-500 text-white">
                                    <CardContent className="p-8">
                                        {/* Location */}
                                        <div className="flex items-center gap-2 mb-8">
                                            <div className="p-2 bg-white/20 rounded-lg">
                                                <MapPin className="size-5" />
                                            </div>
                                            <span className="text-lg font-medium text-white/90">{weather.location}</span>
                                        </div>

                                        {/* Temperature & Icon */}
                                        <div className="flex items-center justify-between mb-10">
                                            <div>
                                                <div className="text-8xl lg:text-9xl font-light tracking-tighter">
                                                    {Math.round(weather.temperature)}°
                                                </div>
                                                <div className="text-xl text-white/80 mt-2">{weather.description}</div>
                                            </div>
                                            <div className="text-9xl lg:text-[10rem] filter drop-shadow-2xl">
                                                {getWeatherIcon(weather.description)}
                                            </div>
                                        </div>

                                        {/* Quick Stats */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
                                                <Thermometer className="size-6 mx-auto mb-2 text-orange-300" />
                                                <div className="text-sm text-white/70">体感温度</div>
                                                <div className="text-xl font-semibold">{Math.round(weather.feelsLike)}°</div>
                                            </div>
                                            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
                                                <Droplets className="size-6 mx-auto mb-2 text-cyan-300" />
                                                <div className="text-sm text-white/70">相对湿度</div>
                                                <div className="text-xl font-semibold">{weather.humidity}%</div>
                                            </div>
                                            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 text-center">
                                                <Wind className="size-6 mx-auto mb-2 text-teal-300" />
                                                <div className="text-sm text-white/70">风速</div>
                                                <div className="text-xl font-semibold">{weather.windSpeed}m/s</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Detailed Stats */}
                                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                                    <CardContent className="p-6">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">详细数据</h3>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                                    <Eye className="size-5 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div>
                                                    <div className="text-sm text-slate-500 dark:text-slate-400">能见度</div>
                                                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">{(weather.visibility / 1000).toFixed(1)} km</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                                    <Gauge className="size-5 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div>
                                                    <div className="text-sm text-slate-500 dark:text-slate-400">气压</div>
                                                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">{weather.pressure} hPa</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                                                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                                                    <Thermometer className="size-5 text-orange-600 dark:text-orange-400" />
                                                </div>
                                                <div>
                                                    <div className="text-sm text-slate-500 dark:text-slate-400">温度</div>
                                                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">{Math.round(weather.temperature)}°C</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                                                <div className="p-3 bg-teal-100 dark:bg-teal-900/30 rounded-xl">
                                                    <Wind className="size-5 text-teal-600 dark:text-teal-400" />
                                                </div>
                                                <div>
                                                    <div className="text-sm text-slate-500 dark:text-slate-400">风速</div>
                                                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-200">{weather.windSpeed} m/s</div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right Column - AI Suggestions */}
                            <div className="space-y-4">
                                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
                                    <div className="h-1 bg-linear-to-r from-purple-500 to-pink-500" />
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                                <Shirt className="size-4 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">穿衣建议</h3>
                                        </div>
                                        {suggestionLoading ? (
                                            <div className="flex items-center gap-2 py-2">
                                                <Loader2 className="size-4 animate-spin text-slate-400" />
                                                <span className="text-sm text-slate-500">AI 正在分析...</span>
                                            </div>
                                        ) : (
                                            formatSuggestion(suggestion?.clothing || "")
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
                                    <div className="h-1 bg-linear-to-r from-emerald-500 to-teal-500" />
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                                <Car className="size-4 text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">出行提醒</h3>
                                        </div>
                                        {suggestionLoading ? (
                                            <div className="flex items-center gap-2 py-2">
                                                <Loader2 className="size-4 animate-spin text-slate-400" />
                                                <span className="text-sm text-slate-500">AI 正在分析...</span>
                                            </div>
                                        ) : (
                                            formatSuggestion(suggestion?.travel || "")
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
