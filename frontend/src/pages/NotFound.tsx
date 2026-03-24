import { Link } from "react-router-dom"
import { Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
    return (
        <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
            <div className="text-center space-y-6 max-w-md">
                <div className="space-y-2">
                    <h1 className="text-7xl font-bold text-primary">404</h1>
                    <h2 className="text-2xl font-semibold">页面未找到</h2>
                    <p className="text-muted-foreground">
                        抱歉，您访问的页面不存在或已被移除。
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild>
                        <Link to="/">
                            <Home className="size-4 mr-2" />
                            返回首页
                        </Link>
                    </Button>
                    <Button variant="outline" onClick={() => window.history.back()}>
                        <ArrowLeft className="size-4 mr-2" />
                        返回上一页
                    </Button>
                </div>
            </div>
        </div>
    )
}
