import { useEffect, useRef, useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, ArrowUp, ArrowDown, ArrowLeft as ArrowLeftIcon, ArrowRight, Pause, Play, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const GRID_SIZE = 20
const INITIAL_SPEED = 150

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"
type Position = { x: number; y: number }

const getRandomPosition = (snake: Position[]): Position => {
    let position: Position
    do {
        position = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
        }
    } while (snake.some((segment) => segment.x === position.x && segment.y === position.y))
    return position
}

export default function SnakeGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [cellSize, setCellSize] = useState(20)
    const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }])
    const [food, setFood] = useState<Position>({ x: 15, y: 10 })
    const [direction, setDirection] = useState<Direction>("RIGHT")
    const [gameOver, setGameOver] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [score, setScore] = useState(0)
    const [highScore, setHighScore] = useState(() => {
        const saved = localStorage.getItem("snake-high-score")
        return saved ? parseInt(saved, 10) : 0
    })
    const [gameStarted, setGameStarted] = useState(false)

    const directionRef = useRef(direction)
    const snakeRef = useRef(snake)
    const foodRef = useRef(food)
    const gameOverRef = useRef(gameOver)
    const isPausedRef = useRef(isPaused)

    useEffect(() => {
        directionRef.current = direction
    }, [direction])

    useEffect(() => {
        snakeRef.current = snake
    }, [snake])

    useEffect(() => {
        foodRef.current = food
    }, [food])

    useEffect(() => {
        gameOverRef.current = gameOver
    }, [gameOver])

    useEffect(() => {
        isPausedRef.current = isPaused
    }, [isPaused])

    useEffect(() => {
        const updateCellSize = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth
                const maxSize = Math.min(containerWidth - 16, 400)
                const newCellSize = Math.floor(maxSize / GRID_SIZE)
                setCellSize(newCellSize)
            }
        }

        updateCellSize()
        window.addEventListener("resize", updateCellSize)
        return () => window.removeEventListener("resize", updateCellSize)
    }, [])

    const resetGame = useCallback(() => {
        const initialSnake = [{ x: 10, y: 10 }]
        setSnake(initialSnake)
        setFood(getRandomPosition(initialSnake))
        setDirection("RIGHT")
        setGameOver(false)
        setIsPaused(false)
        setScore(0)
        setGameStarted(true)
    }, [])

    const drawGame = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const canvasSize = GRID_SIZE * cellSize
        ctx.fillStyle = "#1a1a2e"
        ctx.fillRect(0, 0, canvasSize, canvasSize)

        ctx.strokeStyle = "#2a2a4e"
        ctx.lineWidth = 0.5
        for (let i = 0; i <= GRID_SIZE; i++) {
            ctx.beginPath()
            ctx.moveTo(i * cellSize, 0)
            ctx.lineTo(i * cellSize, canvasSize)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(0, i * cellSize)
            ctx.lineTo(canvasSize, i * cellSize)
            ctx.stroke()
        }

        ctx.fillStyle = "#ef4444"
        ctx.beginPath()
        const foodCenterX = foodRef.current.x * cellSize + cellSize / 2
        const foodCenterY = foodRef.current.y * cellSize + cellSize / 2
        ctx.arc(foodCenterX, foodCenterY, cellSize / 2 - 2, 0, Math.PI * 2)
        ctx.fill()

        snakeRef.current.forEach((segment, index) => {
            const isHead = index === 0
            ctx.fillStyle = isHead ? "#22c55e" : "#16a34a"
            ctx.fillRect(
                segment.x * cellSize + 1,
                segment.y * cellSize + 1,
                cellSize - 2,
                cellSize - 2
            )

            if (isHead) {
                ctx.fillStyle = "#fff"
                const eyeSize = Math.max(2, cellSize / 7)
                const eyeOffset = cellSize / 4
                let eye1X, eye1Y, eye2X, eye2Y

                switch (directionRef.current) {
                    case "UP":
                        eye1X = segment.x * cellSize + eyeOffset
                        eye1Y = segment.y * cellSize + eyeOffset
                        eye2X = segment.x * cellSize + cellSize - eyeOffset
                        eye2Y = segment.y * cellSize + eyeOffset
                        break
                    case "DOWN":
                        eye1X = segment.x * cellSize + eyeOffset
                        eye1Y = segment.y * cellSize + cellSize - eyeOffset
                        eye2X = segment.x * cellSize + cellSize - eyeOffset
                        eye2Y = segment.y * cellSize + cellSize - eyeOffset
                        break
                    case "LEFT":
                        eye1X = segment.x * cellSize + eyeOffset
                        eye1Y = segment.y * cellSize + eyeOffset
                        eye2X = segment.x * cellSize + eyeOffset
                        eye2Y = segment.y * cellSize + cellSize - eyeOffset
                        break
                    case "RIGHT":
                    default:
                        eye1X = segment.x * cellSize + cellSize - eyeOffset
                        eye1Y = segment.y * cellSize + eyeOffset
                        eye2X = segment.x * cellSize + cellSize - eyeOffset
                        eye2Y = segment.y * cellSize + cellSize - eyeOffset
                        break
                }

                ctx.beginPath()
                ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2)
                ctx.fill()
                ctx.beginPath()
                ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2)
                ctx.fill()
            }
        })
    }, [cellSize])

    useEffect(() => {
        if (!gameStarted || gameOver) {
            drawGame()
            return
        }

        const gameLoop = setInterval(() => {
            if (isPausedRef.current || gameOverRef.current) return

            const currentSnake = [...snakeRef.current]
            const head = { ...currentSnake[0] }

            switch (directionRef.current) {
                case "UP":
                    head.y -= 1
                    break
                case "DOWN":
                    head.y += 1
                    break
                case "LEFT":
                    head.x -= 1
                    break
                case "RIGHT":
                    head.x += 1
                    break
            }

            if (
                head.x < 0 ||
                head.x >= GRID_SIZE ||
                head.y < 0 ||
                head.y >= GRID_SIZE ||
                currentSnake.some((segment) => segment.x === head.x && segment.y === head.y)
            ) {
                setGameOver(true)
                if (score > highScore) {
                    setHighScore(score)
                    localStorage.setItem("snake-high-score", score.toString())
                }
                return
            }

            currentSnake.unshift(head)

            if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
                setFood(getRandomPosition(currentSnake))
                setScore((prev) => prev + 10)
            } else {
                currentSnake.pop()
            }

            setSnake(currentSnake)
            drawGame()
        }, INITIAL_SPEED)

        return () => clearInterval(gameLoop)
    }, [gameStarted, gameOver, score, highScore, drawGame])

    useEffect(() => {
        drawGame()
    }, [drawGame])

    const handleDirectionChange = useCallback((newDirection: Direction) => {
        if (!gameStarted || gameOver || isPausedRef.current) return

        const currentDirection = directionRef.current
        const opposites: Record<Direction, Direction> = {
            UP: "DOWN",
            DOWN: "UP",
            LEFT: "RIGHT",
            RIGHT: "LEFT",
        }

        if (opposites[newDirection] !== currentDirection) {
            setDirection(newDirection)
        }
    }, [gameStarted, gameOver])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === " ") {
                e.preventDefault()
            }

            if (!gameStarted && !gameOver) {
                if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    resetGame()
                }
                return
            }

            if (gameOver) {
                if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    resetGame()
                }
                return
            }

            if (e.key === " ") {
                e.preventDefault()
                setIsPaused((prev) => !prev)
                return
            }

            switch (e.key) {
                case "ArrowUp":
                case "w":
                case "W":
                    e.preventDefault()
                    handleDirectionChange("UP")
                    break
                case "ArrowDown":
                case "s":
                case "S":
                    e.preventDefault()
                    handleDirectionChange("DOWN")
                    break
                case "ArrowLeft":
                case "a":
                case "A":
                    e.preventDefault()
                    handleDirectionChange("LEFT")
                    break
                case "ArrowRight":
                case "d":
                case "D":
                    e.preventDefault()
                    handleDirectionChange("RIGHT")
                    break
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [gameStarted, gameOver, resetGame, handleDirectionChange])

    const canvasSize = GRID_SIZE * cellSize

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
                <Link to="/user/games">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="size-5" />
                    </Button>
                </Link>
                <span className="text-2xl">🐍</span>
                <h1 className="text-xl font-bold">贪吃蛇</h1>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden lg:overflow-y-auto">
                <div className="flex flex-col lg:flex-row gap-4 items-center w-full max-w-4xl">
                    <div ref={containerRef} className="w-full flex flex-col items-center gap-3">
                        <div className="flex items-center justify-center gap-4 w-full lg:hidden">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20">
                                <Trophy className="size-5 text-amber-500" />
                                <div>
                                    <div className="text-[10px] text-muted-foreground leading-none">最高分</div>
                                    <div className="text-lg font-bold leading-tight">{highScore}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-primary/10 to-primary/5 border border-primary/20">
                                <div className="size-5 rounded-full bg-primary/20 flex items-center justify-center">
                                    <span className="text-xs font-bold text-primary">{score}</span>
                                </div>
                                <div>
                                    <div className="text-[10px] text-muted-foreground leading-none">当前分数</div>
                                    <div className="text-lg font-bold text-primary leading-tight">{score}</div>
                                </div>
                            </div>
                        </div>

                        <Card className="p-0 overflow-hidden shrink-0 select-none touch-none lg:select-auto lg:touch-auto relative">
                            <canvas
                                ref={canvasRef}
                                width={canvasSize}
                                height={canvasSize}
                                className="block pointer-events-none lg:pointer-events-auto"
                            />
                            {gameOver && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg lg:hidden">
                                    <div className="text-center p-4">
                                        <p className="text-white text-lg font-bold mb-2">游戏结束</p>
                                        <p className="text-white/80 text-sm mb-3">得分: {score}</p>
                                        <Button size="sm" onClick={resetGame}>重新开始</Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>

                    <Card className="w-full lg:w-64 shrink-0 hidden lg:block">
                        <CardHeader className="hidden lg:block">
                            <CardTitle className="text-lg">游戏信息</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="hidden lg:flex justify-between items-center">
                                <span className="text-muted-foreground">当前分数</span>
                                <span className="text-2xl font-bold text-primary">{score}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Trophy className="size-4" /> 最高分
                                </span>
                                <span className="text-xl font-semibold">{highScore}</span>
                            </div>

                            <div className="pt-2 space-y-2 hidden lg:block">
                                {!gameStarted || gameOver ? (
                                    <Button className="w-full" onClick={resetGame}>
                                        {gameOver ? "重新开始" : "开始游戏"}
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full"
                                        variant="outline"
                                        onClick={() => setIsPaused(!isPaused)}
                                    >
                                        {isPaused ? (
                                            <>
                                                <Play className="size-4 mr-2" /> 继续
                                            </>
                                        ) : (
                                            <>
                                                <Pause className="size-4 mr-2" /> 暂停
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>

                            {gameOver && (
                                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-center hidden lg:block">
                                    游戏结束！得分: {score}
                                </div>
                            )}

                            {isPaused && !gameOver && (
                                <div className="p-3 rounded-lg bg-muted text-muted-foreground text-center hidden lg:block">
                                    游戏暂停中
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="shrink-0 p-4 border-t bg-background">
                <div className="flex flex-col items-center gap-4 lg:hidden">
                    <div className="flex items-center gap-4">
                        <div className="grid grid-cols-3 gap-2 w-36">
                            <div></div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-14 w-full touch-manipulation rounded-xl bg-linear-to-b from-background to-muted/50 shadow-md active:scale-95 transition-transform"
                                onTouchStart={(e) => { e.preventDefault(); handleDirectionChange("UP") }}
                                onClick={() => handleDirectionChange("UP")}
                            >
                                <ArrowUp className="size-6" />
                            </Button>
                            <div></div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-14 w-full touch-manipulation rounded-xl bg-linear-to-b from-background to-muted/50 shadow-md active:scale-95 transition-transform"
                                onTouchStart={(e) => { e.preventDefault(); handleDirectionChange("LEFT") }}
                                onClick={() => handleDirectionChange("LEFT")}
                            >
                                <ArrowLeftIcon className="size-6" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-14 w-full touch-manipulation rounded-xl bg-linear-to-b from-background to-muted/50 shadow-md active:scale-95 transition-transform"
                                onTouchStart={(e) => { e.preventDefault(); handleDirectionChange("DOWN") }}
                                onClick={() => handleDirectionChange("DOWN")}
                            >
                                <ArrowDown className="size-6" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-14 w-full touch-manipulation rounded-xl bg-linear-to-b from-background to-muted/50 shadow-md active:scale-95 transition-transform"
                                onTouchStart={(e) => { e.preventDefault(); handleDirectionChange("RIGHT") }}
                                onClick={() => handleDirectionChange("RIGHT")}
                            >
                                <ArrowRight className="size-6" />
                            </Button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {!gameStarted || gameOver ? (
                                <Button 
                                    className="h-14 px-6 rounded-xl shadow-md"
                                    onClick={resetGame}
                                >
                                    {gameOver ? "重新开始" : "开始游戏"}
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="h-14 px-6 rounded-xl shadow-md"
                                    onClick={() => setIsPaused(!isPaused)}
                                >
                                    {isPaused ? (
                                        <>
                                            <Play className="size-5 mr-2" /> 继续
                                        </>
                                    ) : (
                                        <>
                                            <Pause className="size-5 mr-2" /> 暂停
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    {isPaused && !gameOver && gameStarted && (
                        <div className="px-4 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary">
                            游戏暂停中
                        </div>
                    )}
                </div>

                <p className="text-sm text-muted-foreground text-center hidden lg:block">
                    使用 <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">↑</kbd>{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">↓</kbd>{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">←</kbd>{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">→</kbd> 或{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">W</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">A</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">S</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">D</kbd> 控制方向，
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">空格</kbd> 暂停
                </p>
            </div>
        </div>
    )
}
