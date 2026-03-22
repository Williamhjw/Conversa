import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Check, Trophy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { leetcodeApi, type LeetCodeProblem, type LeetCodeProgress, type LeaderboardEntry } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

function initials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
}

function PieChart({ progress }: { progress: LeetCodeProgress }) {
    const { total, solved, byDifficulty } = progress
    const radius = 50
    const centerX = 60
    const centerY = 60

    let currentAngle = -90

    const segments: { color: string; startAngle: number; endAngle: number }[] = []

    const totalSolved = byDifficulty.easy.solved + byDifficulty.medium.solved + byDifficulty.hard.solved

    if (totalSolved > 0) {
        const easyAngle = (byDifficulty.easy.solved / total) * 360
        const mediumAngle = (byDifficulty.medium.solved / total) * 360
        const hardAngle = (byDifficulty.hard.solved / total) * 360

        if (byDifficulty.easy.solved > 0) {
            segments.push({ color: "#22c55e", startAngle: currentAngle, endAngle: currentAngle + easyAngle })
            currentAngle += easyAngle
        }
        if (byDifficulty.medium.solved > 0) {
            segments.push({ color: "#f59e0b", startAngle: currentAngle, endAngle: currentAngle + mediumAngle })
            currentAngle += mediumAngle
        }
        if (byDifficulty.hard.solved > 0) {
            segments.push({ color: "#ef4444", startAngle: currentAngle, endAngle: currentAngle + hardAngle })
        }
    }

    const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
        const start = polarToCartesian(x, y, r, endAngle)
        const end = polarToCartesian(x, y, r, startAngle)
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"
        return [
            "M", x, y,
            "L", start.x, start.y,
            "A", r, r, 0, largeArcFlag, 0, end.x, end.y,
            "Z"
        ].join(" ")
    }

    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees) * Math.PI / 180.0
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        }
    }

    return (
        <div className="flex flex-col items-center">
            <div className="relative">
                <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle
                        cx={centerX}
                        cy={centerY}
                        r={radius}
                        fill="none"
                        stroke="hsl(var(--muted))"
                        strokeWidth="20"
                    />
                    {segments.map((segment, index) => (
                        <path
                            key={index}
                            d={describeArc(centerX, centerY, radius, segment.startAngle, segment.endAngle)}
                            fill={segment.color}
                        />
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{solved}</span>
                    <span className="text-xs text-muted-foreground">/ {total}</span>
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>简单 {byDifficulty.easy.solved}/{byDifficulty.easy.total}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span>中等 {byDifficulty.medium.solved}/{byDifficulty.medium.total}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>困难 {byDifficulty.hard.solved}/{byDifficulty.hard.total}</span>
                </div>
            </div>
        </div>
    )
}

export default function LeetCode() {
    const [problems, setProblems] = useState<LeetCodeProblem[]>([])
    const [progress, setProgress] = useState<LeetCodeProgress | null>(null)
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<"all" | "Easy" | "Medium" | "Hard">("all")
    const [statusFilter, setStatusFilter] = useState<"all" | "solved" | "unsolved">("all")

    useEffect(() => {
        const fetchData = async () => {
            try {
                await leetcodeApi.init()
                const [problemsData, progressData, leaderboardData] = await Promise.all([
                    leetcodeApi.getProblems(),
                    leetcodeApi.getProgress(),
                    leetcodeApi.getLeaderboard(),
                ])
                setProblems(problemsData)
                setProgress(progressData)
                setLeaderboard(leaderboardData)
            } catch (error) {
                toast.error("加载数据失败")
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [])

    const handleToggle = async (problemId: number) => {
        try {
            const result = await leetcodeApi.toggleSolved(problemId)
            setProblems((prev) =>
                prev.map((p) =>
                    p.problemId === problemId ? { ...p, solved: result.solved } : p
                )
            )
            const [progressData, leaderboardData] = await Promise.all([
                leetcodeApi.getProgress(),
                leetcodeApi.getLeaderboard(),
            ])
            setProgress(progressData)
            setLeaderboard(leaderboardData)
        } catch {
            toast.error("更新状态失败")
        }
    }

    const filteredProblems = problems.filter((p) => {
        if (filter !== "all" && p.difficulty !== filter) return false
        if (statusFilter === "solved" && !p.solved) return false
        if (statusFilter === "unsolved" && p.solved) return false
        return true
    })

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case "Easy":
                return "text-green-500"
            case "Medium":
                return "text-amber-500"
            case "Hard":
                return "text-red-500"
            default:
                return "text-muted-foreground"
        }
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
                <Link to="/user/games">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="size-5" />
                    </Button>
                </Link>
                <span className="text-2xl">📝</span>
                <h1 className="text-xl font-bold">LeetCode Hot 100</h1>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">
                    <div className="flex flex-wrap gap-2 px-4 py-3 border-b shrink-0">
                        <div className="flex gap-1">
                            {(["all", "Easy", "Medium", "Hard"] as const).map((f) => (
                                <Button
                                    key={f}
                                    variant={filter === f ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setFilter(f)}
                                    className="h-7 text-xs"
                                >
                                    {f === "all" ? "全部" : f === "Easy" ? "简单" : f === "Medium" ? "中等" : "困难"}
                                </Button>
                            ))}
                        </div>
                        <div className="flex gap-1">
                            {(["all", "solved", "unsolved"] as const).map((f) => (
                                <Button
                                    key={f}
                                    variant={statusFilter === f ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setStatusFilter(f)}
                                    className="h-7 text-xs"
                                >
                                    {f === "all" ? "全部状态" : f === "solved" ? "已刷" : "未刷"}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 lg:overflow-y-auto">
                        {isLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredProblems.map((problem) => (
                                    <div
                                        key={problem._id}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50",
                                            problem.solved && "bg-green-500/10 border-green-500/30"
                                        )}
                                        onClick={() => handleToggle(problem.problemId)}
                                    >
                                        <div
                                            className={cn(
                                                "flex items-center justify-center size-8 rounded-full border-2 shrink-0",
                                                problem.solved
                                                    ? "bg-green-500 border-green-500 text-white"
                                                    : "border-muted-foreground/30"
                                            )}
                                        >
                                            {problem.solved && <Check className="size-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">
                                                    {problem.order}.
                                                </span>
                                                <span className={cn(
                                                    "font-medium truncate",
                                                    problem.solved && "text-green-600 dark:text-green-400"
                                                )}>
                                                    {problem.title}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={cn("text-xs", getDifficultyColor(problem.difficulty))}>
                                                    {problem.difficulty === "Easy" ? "简单" : problem.difficulty === "Medium" ? "中等" : "困难"}
                                                </span>
                                                {problem.tags.slice(0, 2).map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <a
                                            href={`https://leetcode.cn/problems/${problem.titleSlug}/`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="shrink-0"
                                        >
                                            <Button variant="ghost" size="icon" className="size-8">
                                                <ExternalLink className="size-4" />
                                            </Button>
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:w-80 border-t lg:border-t-0 lg:border-l shrink-0 flex flex-col lg:overflow-hidden">
                    <div className="p-4 border-b shrink-0">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">刷题进度</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center pt-2">
                                {progress ? (
                                    <div className="relative">
                                        <PieChart progress={progress} />
                                    </div>
                                ) : (
                                    <Skeleton className="size-40 rounded-full" />
                                )}
                                {progress && (
                                    <p className="mt-3 text-sm text-muted-foreground">
                                        完成率: {progress.percentage}%
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col lg:overflow-hidden">
                        <div className="px-4 py-3 border-b shrink-0">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Trophy className="size-4 text-amber-500" />
                                好友排行榜
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Skeleton key={i} className="h-10 w-full" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {leaderboard.map((entry, index) => (
                                        <div
                                            key={entry._id}
                                            className={cn(
                                                "flex items-center gap-3 p-2 rounded-lg",
                                                entry.isCurrentUser && "bg-primary/10"
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "w-6 text-center font-bold text-sm",
                                                    index === 0 && "text-amber-500",
                                                    index === 1 && "text-gray-400",
                                                    index === 2 && "text-amber-700"
                                                )}
                                            >
                                                {index + 1}
                                            </span>
                                            <Avatar className="size-8">
                                                <AvatarImage src={entry.profilePic} alt={entry.name} />
                                                <AvatarFallback className="text-xs">
                                                    {initials(entry.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="flex-1 truncate text-sm">
                                                {entry.name}
                                                {entry.isCurrentUser && (
                                                    <span className="text-xs text-primary ml-1">(我)</span>
                                                )}
                                            </span>
                                            <span className="text-sm font-semibold text-primary">
                                                {entry.solved}
                                            </span>
                                        </div>
                                    ))}
                                    {leaderboard.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            暂无好友数据
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
