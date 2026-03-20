import { useState, useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Eye, EyeOff, RotateCcw, MessageCircle, Zap, Shield, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/use-auth"
import { authApi } from "@/lib/api"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"

// Floating feature cards shown on large screens
const spotlights = [
    {
        title: "极速传输",
        desc: "通过 WebSocket 连接即时传递消息。",
        icon: Zap,
        side: "left" as const,
        top: "20%",
    },
    {
        title: "隐私安全",
        desc: "您的对话只保留在您信任的人之间。",
        icon: Shield,
        side: "left" as const,
        top: "52%",
    },
    {
        title: "个人AI助手",
        desc: "与您专属的AI助手聊天，由 GLM 4.7 驱动。",
        icon: Bot,
        side: "right" as const,
        top: "20%",
    },
    {
        title: "无密码登录",
        desc: "通过发送到您邮箱的一次性验证码快速登录。",
        icon: MessageCircle,
        side: "right" as const,
        top: "52%",
    },
]

export default function Login() {
    const navigate = useNavigate()
    const { login, loginWithOtp, user } = useAuth()

    // ── password tab ──────────────────────────────────────────────────
    const [pwEmail, setPwEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPass, setShowPass] = useState(false)
    const [pwLoading, setPwLoading] = useState(false)

    // ── otp tab ───────────────────────────────────────────────────────
    const [otpEmail, setOtpEmail] = useState("")
    const [otpCode, setOtpCode] = useState("")
    const [otpSent, setOtpSent] = useState(false)
    const [otpCountdown, setOtpCountdown] = useState(0)
    const [otpLoading, setOtpLoading] = useState(false)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Redirect if already logged in
    useEffect(() => {
        if (user) navigate("/user/conversations", { replace: true })
    }, [user, navigate])

    // OTP countdown ticker
    useEffect(() => {
        if (otpCountdown > 0) {
            countdownRef.current = setInterval(() => {
                setOtpCountdown((c) => {
                    if (c <= 1) {
                        clearInterval(countdownRef.current!)
                        return 0
                    }
                    return c - 1
                })
            }, 1000)
        }
        return () => clearInterval(countdownRef.current!)
    }, [otpCountdown])

    // ── handlers ──────────────────────────────────────────────────────
    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!pwEmail || !password) {
            toast.error("请填写所有字段。")
            return
        }
        setPwLoading(true)
        try {
            await login(pwEmail.trim(), password)
            navigate("/user/conversations", { replace: true })
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "登录失败，请重试。")
        } finally {
            setPwLoading(false)
        }
    }

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!otpEmail) {
            toast.error("请输入您的邮箱地址。")
            return
        }
        setOtpLoading(true)
        try {
            await authApi.sendOtp(otpEmail.trim())
            setOtpSent(true)
            setOtpCountdown(60)
            toast.success("验证码已发送！请查收您的邮箱。")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "发送验证码失败。")
        } finally {
            setOtpLoading(false)
        }
    }

    const handleOtpLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (otpCode.length !== 6) {
            toast.error("请输入完整的6位验证码。")
            return
        }
        setOtpLoading(true)
        try {
            await loginWithOtp(otpEmail.trim(), otpCode)
            navigate("/user/conversations", { replace: true })
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "验证码无效，请重试。")
        } finally {
            setOtpLoading(false)
        }
    }

    const handleResendOtp = async () => {
        if (otpCountdown > 0) return
        setOtpCode("")
        setOtpLoading(true)
        try {
            await authApi.sendOtp(otpEmail.trim())
            setOtpCountdown(60)
            toast.success("验证码已重新发送！请查收您的邮箱。")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "重新发送验证码失败。")
        } finally {
            setOtpLoading(false)
        }
    }

    return (
        <div className="relative h-full overflow-hidden bg-background">
            {/* ── Spotlight cards – visible on large screens only ─────── */}
            {spotlights.map((s) => {
                const Icon = s.icon
                return (
                    <div
                        key={s.title}
                        className="pointer-events-none absolute hidden xl:flex flex-col gap-2 w-56 p-4 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-lg shadow-black/5 dark:shadow-black/20"
                        style={{
                            [s.side]: "calc(50% - 340px - 240px)",
                            top: s.top,
                            transform: "translateX(0)",
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                                <Icon className="h-4 w-4 text-primary" />
                            </span>
                            <p className="text-sm font-semibold">{s.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                )
            })}

            {/* ── Scrollable center column ────────────────────────────── */}
            <div className="relative z-10 h-full overflow-y-auto flex flex-col items-center justify-center px-4 py-10">
                <div className="w-full max-w-100 flex flex-col gap-6">

                    {/* Brand */}
                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
                            <MessageCircle className="h-7 w-7 text-primary" strokeWidth={1.8} />
                        </div>
                        <div>
                            <h1 className="text-5xl font-bold tracking-tight leading-none text-foreground">
                                Conversa
                            </h1>
                            <p className="mt-1.5 text-sm text-muted-foreground">
                                随时随地，即时聊天。
                            </p>
                        </div>
                    </div>

                    {/* Form card */}
                    <Card className="rounded-2xl border border-border/60 bg-card shadow-xl shadow-black/5 dark:shadow-black/25 p-6">
                        <div className="mb-5">
                            <h2 className="text-2xl font-semibold tracking-tight">欢迎回来</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">登录您的账户以继续</p>
                        </div>

                        <Tabs defaultValue="password" className="w-full">
                            <TabsList className="w-full grid grid-cols-2 mb-5">
                                <TabsTrigger value="password">密码登录</TabsTrigger>
                                <TabsTrigger value="otp">验证码登录</TabsTrigger>
                            </TabsList>

                            {/* ── Password Tab ───────────────────────── */}
                            <TabsContent value="password">
                                <form onSubmit={handlePasswordLogin} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="pw-email">邮箱地址</Label>
                                        <Input
                                            id="pw-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            value={pwEmail}
                                            onChange={(e) => setPwEmail(e.target.value)}
                                            disabled={pwLoading}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="pw-password">密码</Label>
                                        <div className="relative">
                                            <Input
                                                id="pw-password"
                                                type={showPass ? "text" : "password"}
                                                placeholder="••••••••"
                                                autoComplete="current-password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                disabled={pwLoading}
                                                className="pr-10"
                                            />
                                            <button
                                                type="button"
                                                tabIndex={-1}
                                                onClick={() => setShowPass((v) => !v)}
                                                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full bg-primary/90 hover:bg-primary"
                                        disabled={pwLoading}
                                    >
                                        {pwLoading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                                        {pwLoading ? "登录中…" : "登录"}
                                    </Button>
                                </form>
                            </TabsContent>

                            {/* ── OTP Tab ─────────────────────────────── */}
                            <TabsContent value="otp">
                                <div className="space-y-4">
                                    {!otpSent ? (
                                        <form onSubmit={handleSendOtp} className="space-y-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="otp-email">邮箱地址</Label>
                                                <Input
                                                    id="otp-email"
                                                    type="email"
                                                    placeholder="you@example.com"
                                                    autoComplete="email"
                                                    value={otpEmail}
                                                    onChange={(e) => setOtpEmail(e.target.value)}
                                                    disabled={otpLoading}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                我们将向您的邮箱发送一次性验证码，有效期5分钟。
                                            </p>
                                            <Button
                                                type="submit"
                                                className="w-full bg-primary/90 hover:bg-primary"
                                                disabled={otpLoading}
                                            >
                                                {otpLoading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                                                {otpLoading ? "发送中…" : "发送验证码"}
                                            </Button>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleOtpLogin} className="space-y-4">
                                            <div className="space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <Label>输入验证码</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        已发送至{" "}
                                                        <span className="font-medium text-foreground">{otpEmail}</span>
                                                    </span>
                                                </div>
                                                <div className="flex justify-center pt-1">
                                                    <InputOTP
                                                        maxLength={6}
                                                        value={otpCode}
                                                        onChange={setOtpCode}
                                                        disabled={otpLoading}
                                                    >
                                                        <InputOTPGroup>
                                                            <InputOTPSlot index={0} />
                                                            <InputOTPSlot index={1} />
                                                            <InputOTPSlot index={2} />
                                                            <InputOTPSlot index={3} />
                                                            <InputOTPSlot index={4} />
                                                            <InputOTPSlot index={5} />
                                                        </InputOTPGroup>
                                                    </InputOTP>
                                                </div>
                                            </div>
                                            <Button
                                                type="submit"
                                                className="w-full bg-primary/90 hover:bg-primary"
                                                disabled={otpLoading || otpCode.length !== 6}
                                            >
                                                {otpLoading ? <Spinner className="w-4 h-4 mr-2" /> : null}
                                                {otpLoading ? "验证中…" : "验证码登录"}
                                            </Button>
                                            <div className="flex items-center justify-between text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => { setOtpSent(false); setOtpCode("") }}
                                                    className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                                >
                                                    ← 更换邮箱
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleResendOtp}
                                                    disabled={otpCountdown > 0 || otpLoading}
                                                    className="flex items-center gap-1 hover:opacity-80 disabled:opacity-40 transition-opacity"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    {otpCountdown > 0 ? `${otpCountdown}秒后重发` : "重新发送"}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>

                    {/* Footer links */}
                    <div className="flex flex-col items-center gap-3">
                        <p className="text-center text-sm text-muted-foreground">
                            还没有账户？{" "}
                            <Link to="/signup" className="font-medium text-primary hover:opacity-80 transition-opacity">
                                创建一个
                            </Link>
                        </p>
                        <Link to="/">
                            <Button variant="link" size="sm" className="text-muted-foreground text-xs h-8">
                                <ArrowLeft className="w-3 h-3 mr-1" />
                                返回首页
                            </Button>
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    )
}
