import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Loader2, Circle, Users, Check } from "lucide-react"
import { toast } from "sonner"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

import { userApi, groupApi, type NonFriendsSort } from "@/lib/api"
import { useConversations } from "@/hooks/use-conversations"
import type { User } from "@/hooks/use-auth"

interface NonFriendsResponse {
    users: User[]
    pinnedUser: User | null
    hasMore: boolean
    total: number
    page: number
}

const LIMIT = 20

function initials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
}

function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(id)
    }, [value, delay])
    return debounced
}

function formatLastSeen(lastSeen: Date | string | undefined): string {
    if (!lastSeen) return "Last seen unknown"
    const diff = Date.now() - new Date(lastSeen).getTime()
    const secs = Math.floor(diff / 1_000)
    const mins = Math.floor(diff / 60_000)
    const hrs = Math.floor(diff / 3_600_000)
    const days = Math.floor(diff / 86_400_000)
    if (secs < 60) return "刚刚在线"
    if (mins < 60) return `${mins}分钟前`
    if (hrs < 24) return `${hrs}小时前`
    if (days < 7) return `${days}天前`
    return new Date(lastSeen).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

interface UserRowProps {
    user: User
    selected: boolean
    onToggle: () => void
}

function UserRow({ user, selected, onToggle }: UserRowProps) {
    return (
        <button
            onClick={onToggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-accent/60"
        >
            <div className="relative shrink-0">
                <Avatar className="size-10">
                    <AvatarImage src={user.profilePic} alt={user.name} />
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold">
                        {initials(user.name)}
                    </AvatarFallback>
                </Avatar>
                {selected && (
                    <div className="absolute -top-1 -right-1 size-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="size-3 text-white" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                    {user.isOnline ? (
                        <>
                            <Circle className="size-1.5 fill-green-500 text-green-500 shrink-0" />
                            <span className="text-xs text-green-600 dark:text-green-400 truncate">在线</span>
                        </>
                    ) : (
                        <span className="text-xs text-muted-foreground truncate">
                            {formatLastSeen(user.lastSeen)}
                        </span>
                    )}
                </div>
            </div>
        </button>
    )
}

function UserRowSkeleton() {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="size-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
    )
}

interface CreateGroupDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
    const navigate = useNavigate()
    const { fetchConversations } = useConversations()

    const [query, setQuery] = useState("")
    const [sort, setSort] = useState<NonFriendsSort>("name_asc")
    const [users, setUsers] = useState<User[]>([])
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [creating, setCreating] = useState(false)

    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
    const [groupName, setGroupName] = useState("")
    const [groupDescription, setGroupDescription] = useState("")

    const debouncedQuery = useDebounce(query, 350)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)

    const fetchPage = useCallback(
        async (pg: number, q: string, s: NonFriendsSort, append: boolean) => {
            if (pg === 1) setLoading(true)
            else setLoadingMore(true)

            try {
                const data = await userApi.getNonFriends({
                    search: q || undefined,
                    sort: s,
                    page: pg,
                    limit: LIMIT,
                }) as NonFriendsResponse

                if (append) {
                    setUsers((prev) => [...prev, ...data.users])
                } else {
                    setUsers(data.users)
                    if (listRef.current) listRef.current.scrollTop = 0
                }
                setHasMore(data.hasMore)
                setPage(pg)
            } catch {
                toast.error("加载用户失败")
            } finally {
                setLoading(false)
                setLoadingMore(false)
            }
        },
        []
    )

    useEffect(() => {
        if (!open) return
        fetchPage(1, debouncedQuery, sort, false)
    }, [open, debouncedQuery, sort, fetchPage])

    useEffect(() => {
        if (!open) {
            setQuery("")
            setUsers([])
            setPage(1)
            setHasMore(false)
            setSelectedUsers(new Set())
            setGroupName("")
            setGroupDescription("")
        }
    }, [open])

    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
                    fetchPage(page + 1, debouncedQuery, sort, true)
                }
            },
            { threshold: 0.1 }
        )

        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [hasMore, loadingMore, loading, page, debouncedQuery, sort, fetchPage])

    const toggleUser = (userId: string) => {
        setSelectedUsers((prev) => {
            const next = new Set(prev)
            if (next.has(userId)) {
                next.delete(userId)
            } else {
                next.add(userId)
            }
            return next
        })
    }

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            toast.error("请输入群组名称")
            return
        }
        if (selectedUsers.size === 0) {
            toast.error("请至少选择一位成员")
            return
        }

        setCreating(true)
        try {
            const group = await groupApi.create({
                name: groupName.trim(),
                memberIds: Array.from(selectedUsers),
                description: groupDescription.trim() || undefined,
            }) as { _id: string }

            await fetchConversations()
            onOpenChange(false)
            navigate(`/user/conversations/${group._id}`)
            toast.success("群组创建成功")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "创建群组失败")
        } finally {
            setCreating(false)
        }
    }

    const selectedUsersList = users.filter((u) => selectedUsers.has(u._id))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="px-4 pt-6 pb-3 shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="size-5" />
                        创建群组
                    </DialogTitle>
                </DialogHeader>

                <div className="px-4 pb-3 space-y-3 shrink-0 border-b">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">群组名称</label>
                        <Input
                            placeholder="输入群组名称…"
                            className="h-9"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            maxLength={50}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">群组简介（可选）</label>
                        <Textarea
                            placeholder="介绍一下这个群组…"
                            className="min-h-[60px] resize-none"
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            maxLength={200}
                        />
                    </div>

                    {selectedUsers.size > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {selectedUsersList.map((u) => (
                                <Badge
                                    key={u._id}
                                    variant="secondary"
                                    className="gap-1 pr-1"
                                >
                                    <span>{u.name}</span>
                                    <button
                                        onClick={() => toggleUser(u._id)}
                                        className="size-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
                                    >
                                        ×
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}

                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="搜索用户…"
                            className="pl-8 h-9"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    <Select value={sort} onValueChange={(v) => setSort(v as NonFriendsSort)}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="排序方式…" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name_asc">姓名 - A → Z</SelectItem>
                            <SelectItem value="name_desc">姓名 - Z → A</SelectItem>
                            <SelectItem value="last_seen_recent">最近在线 - 最近</SelectItem>
                            <SelectItem value="last_seen_oldest">最近在线 - 最早</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5 min-h-[200px]">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => <UserRowSkeleton key={i} />)
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                            <Search className="size-8 opacity-30" />
                            <p className="text-sm">
                                {query ? "未找到用户" : "暂无可添加的用户"}
                            </p>
                        </div>
                    ) : (
                        <>
                            {users.map((u) => (
                                <UserRow
                                    key={u._id}
                                    user={u}
                                    selected={selectedUsers.has(u._id)}
                                    onToggle={() => toggleUser(u._id)}
                                />
                            ))}

                            <div ref={sentinelRef} className="h-1" />

                            {loadingMore && (
                                <div className="flex justify-center py-3">
                                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="px-4 py-3 border-t shrink-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={creating}
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleCreateGroup}
                        disabled={creating || !groupName.trim() || selectedUsers.size === 0}
                    >
                        {creating ? (
                            <>
                                <Loader2 className="size-4 animate-spin mr-2" />
                                创建中…
                            </>
                        ) : (
                            `创建群组 (${selectedUsers.size} 人)`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
