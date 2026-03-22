import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Search, MessageCircle, Bot, SquarePen, ChevronDown, Trash2, ShieldX, Pin, PinOff, Users, UserX, Sparkles } from "lucide-react"
import { useConversations, type Conversation } from "@/hooks/use-conversations"
import { useAuth } from "@/hooks/use-auth"
import { useChat } from "@/hooks/use-chat"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GroupAvatar } from "@/components/ui/group-avatar"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { userApi, messageApi, conversationApi, groupApi } from "@/lib/api"
import { toast } from "sonner"
import socket from "@/lib/socket"
import type { User } from "@/hooks/use-auth"
import { Button } from "../ui/button"
import NewChatDialog from "./NewChatDialog"
import CreateGroupDialog from "./CreateGroupDialog"

/* ─── helpers ──────────────────────────────────────────────────────────── */

function getOtherMember(conv: Conversation, myId: string): User | undefined {
    return conv.members.find((m) => m._id !== myId)
}

function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return "刚刚"
    if (mins < 60) return `${mins}分钟`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}小时`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}天`
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function initials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
}

/* ─── skeleton row ─────────────────────────────────────────────────────── */
function ConversationSkeleton() {
    return (
        <div className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="size-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
            </div>
        </div>
    )
}

/* ─── single conversation row ──────────────────────────────────────────── */
interface RowProps {
    conv: Conversation
    myId: string
    isActive: boolean
    isTyping: boolean
    onClick: () => void
    openDropdownId: string | null
    setOpenDropdownId: (id: string | null) => void
    onToggleBlock: (userId: string, userName: string, isBlocked: boolean) => Promise<void>
    onClearChat: (convId: string) => Promise<void>
    onTogglePin: (convId: string) => Promise<void>
    onDeleteConversation: (convId: string, convName: string) => Promise<void>
    onSummarizeUnread: (convId: string, convName: string) => void
    blockedUsers: Set<string>
}

function ConversationRow({ conv, myId, isActive, isTyping, onClick, openDropdownId, setOpenDropdownId, onToggleBlock, onClearChat, onTogglePin, onDeleteConversation, onSummarizeUnread, blockedUsers }: RowProps) {
    const other = getOtherMember(conv, myId)
    const unread = conv.unreadCounts.find((u) => u.userId === myId)?.count ?? 0
    
    const isGroup = conv.isGroup
    const name = isGroup ? (conv.groupName || "未命名群组") : (other?.name ?? "未知")
    const avatar = isGroup ? conv.groupAvatar : other?.profilePic
    const isBot = isGroup ? false : other?.isBot
    const isOnline = isGroup ? true : other?.isOnline
    
    const preview = isTyping
        ? "正在输入…"
        : conv.latestmessage || "开始对话"
    const dropdownOpen = openDropdownId === conv._id
    const isBlocked = isGroup ? false : (other ? blockedUsers.has(other._id) : false)
    const isPinned = conv.isPinned

    return (
        <div className="relative group">
            {/* Dropdown button — always visible on mobile, hover on desktop */}
            {(!isBot) && (
                <div
                    className={cn(
                        "absolute right-2 top-3.5 z-10 transition-opacity",
                        "opacity-100 pointer-events-auto md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    <DropdownMenu
                        open={dropdownOpen}
                        onOpenChange={(open) => setOpenDropdownId(open ? conv._id : null)}
                    >
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center justify-center size-6 rounded-md 
                            bg-gray-200/80 hover:bg-gray-200
                            dark:bg-sidebar-accent dark:text-muted-foreground dark:hover:text-foreground
                            active:scale-95 transition-transform">
                                <ChevronDown className="size-3.5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(conv._id) }}
                            >
                                {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                                {isPinned ? "取消置顶" : "置顶"}
                            </DropdownMenuItem>
                            {isGroup && unread > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={(e) => { e.stopPropagation(); onSummarizeUnread(conv._id, name) }}
                                    >
                                        <Sparkles className="size-4" />
                                        AI 总结未读
                                    </DropdownMenuItem>
                                </>
                            )}
                            {!isGroup && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={(e) => { e.stopPropagation(); onToggleBlock(other!._id, other!.name, isBlocked) }}
                                        variant="destructive"
                                    >
                                        <ShieldX className="size-4" />
                                        {isBlocked ? "解除屏蔽" : "屏蔽用户"}
                                    </DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onClearChat(conv._id) }}
                                variant="destructive"
                            >
                                <Trash2 className="size-4" />
                                清空聊天
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv._id, name) }}
                                variant="destructive"
                            >
                                <UserX className="size-4" />
                                {isGroup ? "退出群组" : "删除好友"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
            <div
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={(e) => e.key === "Enter" && onClick()}
                className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors cursor-pointer",
                    isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/60"
                )}
            >
                {/* avatar */}
                <div className="relative shrink-0">
                    {isGroup ? (
                        <GroupAvatar members={conv.members} size={40} />
                    ) : (
                        <Avatar className="size-10">
                            <AvatarImage src={avatar} alt={name} />
                            <AvatarFallback className="bg-primary/15 text-xs font-semibold">
                                {isBot ? <Bot className="size-4" /> : initials(name || "U")}
                            </AvatarFallback>
                        </Avatar>
                    )}
                    {/* online dot */}
                    {!isGroup && isOnline && (
                        <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-sidebar" />
                    )}
                </div>

                {/* text */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                        <span className="truncate text-sm font-medium leading-tight">{name}</span>
                        <div className="flex items-center gap-1">
                            {isPinned && <Pin className="size-2.5 text-primary shrink-0" />}
                            <span className={`shrink-0 text-[10px] text-muted-foreground mr-6 md:mr-0 md:group-hover:mr-5 ${dropdownOpen ? "md:mr-5" : ""}`}>
                                {relativeTime(conv.updatedAt)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-1">
                        <p
                            className={cn(
                                "truncate text-xs",
                                isTyping
                                    ? " italic"
                                    : unread > 0
                                        ? "text-foreground font-medium"
                                        : "text-muted-foreground"
                            )}
                        >
                            {preview}
                        </p>
                        {unread > 0 && !isTyping && (
                            <span className="shrink-0 flex bg-primary items-center justify-center min-w-5 h-5 rounded-full text-white text-[10px] font-bold px-1">
                                {unread > 99 ? "99+" : unread}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ─── main component ───────────────────────────────────────────────────── */
export default function ConversationsList() {
    const { conversationsList, setConversationsList, fetchConversations, isLoading } =
        useConversations()
    const { user } = useAuth()
    const { typingConversations } = useChat()
    const navigate = useNavigate()
    const { id: activeId } = useParams<{ id: string }>()

    const [query, setQuery] = useState("")
    const [filter, setFilter] = useState<"all" | "unread" | "online">("all")
    const [newChatOpen, setNewChatOpen] = useState(false)
    const [createGroupOpen, setCreateGroupOpen] = useState(false)
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
    const [blockedUsers, setBlockedUsers] = useState<Set<string>>(
        () => new Set((user?.blockedUsers ?? []).map(String))
    )

    const [summaryDialogOpen, setSummaryDialogOpen] = useState(false)
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [summaryData, setSummaryData] = useState<{ summary: string; unreadCount: number; groupName: string } | null>(null)

    // toggle block/unblock a user from the conversations list
    const handleToggleBlock = async (userId: string, userName: string, isBlocked: boolean) => {
        try {
            if (isBlocked) {
                await userApi.unblockUser(userId)
                setBlockedUsers((prev) => { const s = new Set(prev); s.delete(userId); return s })
                toast.success(`${userName} 已解除屏蔽`)
            } else {
                await userApi.blockUser(userId)
                setBlockedUsers((prev) => new Set(prev).add(userId))
                toast.success(`${userName} 已被屏蔽`)
            }
            setOpenDropdownId(null)
        } catch {
            toast.error(isBlocked ? "解除屏蔽失败" : "屏蔽用户失败")
        }
    }

    const handleClearChatRow = async (convId: string) => {
        try {
            await messageApi.clearChat(convId)
            setOpenDropdownId(null)
            toast.success("聊天已清空")
        } catch {
            toast.error("清空聊天失败")
        }
    }

    const handleTogglePin = async (convId: string) => {
        try {
            const { isPinned } = await conversationApi.togglePin(convId)
            setConversationsList((prev) => {
                const updated = prev.map((c) =>
                    c._id === convId ? { ...c, isPinned } : c
                )
                return [...updated.filter((c) => c.isPinned && c._id === convId), ...updated.filter((c) => c.isPinned && c._id !== convId), ...(updated.filter((c) => !c.isPinned).sort(
                    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))]
            })
            setOpenDropdownId(null)
            toast.success(isPinned ? "对话已置顶" : "对话已取消置顶")
        } catch {
            toast.error("置顶操作失败")
        }
    }

    const handleDeleteConversation = async (convId: string, convName: string) => {
        const conv = conversationsList.find((c) => c._id === convId)
        const isGroup = conv?.isGroup
        const actionText = isGroup ? "退出群组" : "删除好友"
        const confirmText = isGroup 
            ? `确定要退出群组「${convName}」吗？` 
            : `确定要删除与 ${convName} 的好友关系吗？\n\n这将删除你们之间的所有聊天记录。`
        
        if (!confirm(confirmText)) {
            return
        }
        try {
            await conversationApi.delete(convId)
            setConversationsList((prev) => prev.filter((c) => c._id !== convId))
            setOpenDropdownId(null)
            if (activeId === convId) {
                navigate("/user")
            }
            toast.success(isGroup ? `已退出群组「${convName}」` : `已删除与 ${convName} 的好友关系`)
        } catch (err) {
            console.error("删除对话错误:", err)
            const errorMsg = err instanceof Error ? err.message : `${actionText}失败`
            toast.error(errorMsg)
        }
    }

    const handleSummarizeUnread = async (convId: string, convName: string) => {
        setOpenDropdownId(null)
        setSummaryLoading(true)
        setSummaryData({ summary: "", unreadCount: 0, groupName: convName })
        setSummaryDialogOpen(true)

        try {
            const result = await groupApi.summarizeUnread(convId)
            setSummaryData({
                summary: result.summary,
                unreadCount: result.unreadCount,
                groupName: convName
            })
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "生成总结失败")
            setSummaryDialogOpen(false)
        } finally {
            setSummaryLoading(false)
        }
    }

    // Initial fetch
    useEffect(() => {
        fetchConversations()
    }, [fetchConversations])

    // Socket: realtime online/offline status updates
    useEffect(() => {
        if (!user) return

        const updateOnlineStatus = (userId: string, isOnline: boolean) => {
            setConversationsList((prev) =>
                prev.map((conv) => ({
                    ...conv,
                    members: conv.members.map((m) =>
                        m._id === userId ? { ...m, isOnline } : m
                    ),
                }))
            )
        }

        const onUserOnline = ({ userId }: { userId: string }) =>
            updateOnlineStatus(userId, true)
        const onUserOffline = ({ userId }: { userId: string }) =>
            updateOnlineStatus(userId, false)

        socket.on("user-online", onUserOnline)
        socket.on("user-offline", onUserOffline)
        return () => {
            socket.off("user-online", onUserOnline)
            socket.off("user-offline", onUserOffline)
        }
    }, [user, setConversationsList])

    // Derive displayed list (search + tab filter applied to freshest conversationsList)
    const displayList = conversationsList.filter((conv) => {
        const other = getOtherMember(conv, user?._id ?? "")
        if (query.trim() && !other?.name.toLowerCase().includes(query.toLowerCase())) return false
        if (filter === "unread") {
            const unread = conv.unreadCounts.find((u) => u.userId === (user?._id ?? ""))?.count ?? 0
            return unread > 0
        }
        if (filter === "online") return !!(other?.isBot || other?.isOnline)
        return true
    })

    return (
        <div className="flex h-full flex-col">

            {/* header */}
            <div className="flex items-center justify-between px-4 py-0 lg:py-4">
                <h1 className="text-lg font-bold">聊天</h1>
                <div className="flex items-center gap-1">
                    <Button variant={"outline"} size={"icon"} onClick={() => setCreateGroupOpen(true)} title="创建群组">
                        <Users className="size-4" />
                    </Button>
                    <Button variant={"outline"} size={"icon"} onClick={() => setNewChatOpen(true)} title="新建私聊">
                        <SquarePen className="size-4" />
                    </Button>
                </div>
            </div>

            <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />
            <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />

            <div className="px-3 pt-2 pb-2 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="搜索对话…"
                        className="pl-8 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                <div className="flex gap-1.5 px-3 pt-2 pb-1">
                    {(["all", "unread", "online"] as const).map((f) => (
                        <Button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "rounded-full px-3 h-7 text-xs font-medium transition-colors capitalize",
                                filter === f
                                    ? "bg-primary/20 text-primary hover:bg-primary/20"
                                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            )}
                        >
                            {f === "all" ? "全部" : f === "unread" ? "未读" : "在线"}
                        </Button>
                    ))}
                </div>
                <div className="px-2 space-y-0.5">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => <ConversationSkeleton key={i} />)
                    ) : displayList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                            <MessageCircle className="size-8 opacity-30" />
                            <p className="text-sm">
                                {query
                                    ? "未找到结果"
                                    : filter === "unread"
                                        ? "没有未读对话"
                                        : filter === "online"
                                            ? "当前没有人在线"
                                            : "暂无对话"}
                            </p>
                        </div>
                    ) : (
                        displayList.map((conv) => (
                            <ConversationRow
                                key={conv._id}
                                conv={conv}
                                myId={user?._id ?? ""}
                                isActive={conv._id === activeId}
                                isTyping={!!typingConversations[conv._id]}
                                onClick={() => navigate(`/user/conversations/${conv._id}`)}
                                openDropdownId={openDropdownId}
                                setOpenDropdownId={setOpenDropdownId}
                                onToggleBlock={handleToggleBlock}
                                onClearChat={handleClearChatRow}
                                onTogglePin={handleTogglePin}
                                onDeleteConversation={handleDeleteConversation}
                                onSummarizeUnread={handleSummarizeUnread}
                                blockedUsers={blockedUsers}
                            />
                        ))
                    )}
                </div>
            </div>

            <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="size-5 text-primary" />
                            AI 未读消息总结
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {summaryLoading ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-3">
                                <Spinner className="size-6 text-primary" />
                                <p className="text-sm text-muted-foreground">正在生成总结…</p>
                            </div>
                        ) : summaryData && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">{summaryData.groupName}</span>
                                    <span>·</span>
                                    <span>{summaryData.unreadCount} 条未读消息</span>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/50 border">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{summaryData.summary}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
