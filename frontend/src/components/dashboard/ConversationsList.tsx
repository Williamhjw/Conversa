import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Search, MessageCircle, Bot, SquarePen } from "lucide-react"
import { useConversations, type Conversation } from "@/hooks/use-conversation"
import { useAuth } from "@/hooks/use-auth"
import { useChat } from "@/hooks/use-chat"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import socket from "@/lib/socket"
import type { User } from "@/hooks/use-auth"
import { Button } from "../ui/button"
import NewChatDialog from "./NewChatDialog"

/* ─── helpers ──────────────────────────────────────────────────────────── */

function getOtherMember(conv: Conversation, myId: string): User | undefined {
    return conv.members.find((m) => m._id !== myId)
}

function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return "now"
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d`
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
}

function ConversationRow({ conv, myId, isActive, isTyping, onClick }: RowProps) {
    const other = getOtherMember(conv, myId)
    const unread = conv.unreadCounts.find((u) => u.userId === myId)?.count ?? 0
    const name = other?.name ?? "Unknown"
    const preview = isTyping
        ? "typing…"
        : conv.latestmessage || "Start a conversation"

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors",
                isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/60"
            )}
        >
            {/* avatar */}
            <div className="relative shrink-0">
                <Avatar className="size-10">
                    <AvatarImage src={other?.profilePic} alt={name} />
                    <AvatarFallback className="bg-primary/15  text-xs font-semibold">
                        {other?.isBot ? <Bot className="size-4" /> : initials(name)}
                    </AvatarFallback>
                </Avatar>
                {/* online dot */}
                {(other?.isBot || other?.isOnline) && (
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-sidebar" />
                )}
            </div>

            {/* text */}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                    <span className="truncate text-sm font-medium leading-tight">{name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                        {relativeTime(conv.updatedAt)}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
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
                        <span className="shrink-0 flex items-center justify-center min-w-5 h-5 rounded-full text-white text-[10px] font-bold px-1">
                            {unread > 99 ? "99+" : unread}
                        </span>
                    )}
                </div>
            </div>
        </button>
    )
}

/* ─── main component ───────────────────────────────────────────────────── */
export default function ConversationsList() {
    const { chatList, setChatList, fetchConversations, isLoading } =
        useConversations()
    const { user } = useAuth()
    const { typingConversations } = useChat()
    const navigate = useNavigate()
    const { id: activeId } = useParams<{ id: string }>()

    const [query, setQuery] = useState("")
    const [newChatOpen, setNewChatOpen] = useState(false)

    // Initial fetch
    useEffect(() => {
        fetchConversations()
    }, [fetchConversations])

    // Socket: realtime online/offline status updates
    useEffect(() => {
        if (!user) return

        const updateOnlineStatus = (userId: string, isOnline: boolean) => {
            setChatList((prev) =>
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
    }, [user, setChatList])

    // Derive displayed list (search filter applied to freshest chatList)
    const displayList = query.trim()
        ? chatList.filter((conv) => {
            const other = getOtherMember(conv, user?._id ?? "")
            return other?.name.toLowerCase().includes(query.toLowerCase())
        })
        : chatList

    return (
        <div className="flex h-full flex-col">

            {/* header */}
            <div className="flex items-center justify-between px-4 py-0 lg:py-4">
                <h1 className="text-lg font-bold">Chats</h1>
                <Button variant={"outline"} size={"icon"} onClick={() => setNewChatOpen(true)}>
                    <SquarePen className="size-4" />
                </Button>
            </div>

            <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />

            {/* Search bar */}
            <div className="px-3 py-2 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Search conversations…"
                        className="pl-8 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <ConversationSkeleton key={i} />)
                ) : displayList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                        <MessageCircle className="size-8 opacity-30" />
                        <p className="text-sm">
                            {query ? "No results found" : "No conversations yet"}
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
                        />
                    ))
                )}
            </div>
        </div>
    )
}
