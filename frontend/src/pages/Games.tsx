import { Link } from "react-router-dom"
import { ArrowLeft, Gamepad2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const GAMES = [
    {
        id: "snake",
        title: "贪吃蛇",
        description: "经典贪吃蛇游戏，控制蛇吃食物并不断成长",
        icon: "🐍",
        href: "/user/games/snake",
    },
    {
        id: "leetcode",
        title: "LeetCode Hot 100",
        description: "刷题挑战，记录你的刷题进度，与好友比拼",
        icon: "📝",
        href: "/user/games/leetcode",
    },
]

export default function Games() {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b">
                <Gamepad2 className="size-6 text-primary" />
                <h1 className="text-xl font-bold">游戏中心</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {GAMES.map((game) => (
                        <Link key={game.id} to={game.href}>
                            <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <span className="text-4xl">{game.icon}</span>
                                        <div>
                                            <CardTitle className="text-lg">{game.title}</CardTitle>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-sm">
                                        {game.description}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                <div className="mt-8 p-6 rounded-lg bg-muted/30 border text-center">
                    <p className="text-muted-foreground">更多游戏即将上线，敬请期待...</p>
                </div>
            </div>
        </div>
    )
}
