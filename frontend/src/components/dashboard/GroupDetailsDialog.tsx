import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
    Users, Settings, UserPlus, UserMinus, Crown, Shield, ShieldOff,
    LogOut, Edit2, Loader2, Check
} from "lucide-react"
import { toast } from "sonner"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { GroupAvatar } from "@/components/ui/group-avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { groupApi, userApi } from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"
import { useConversations } from "@/hooks/use-conversations"
import type { User } from "@/hooks/use-auth"

interface GroupMember extends User {
    isOwner?: boolean
    isAdmin?: boolean
}

interface GroupInfo {
    _id: string
    isGroup: boolean
    groupName: string
    groupAvatar: string
    groupDescription: string
    groupOwner: User
    groupAdmins: User[]
    members: GroupMember[]
    createdAt: string
}

interface GroupDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    groupId: string | null
}

function initials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
}

export default function GroupDetailsDialog({ open, onOpenChange, groupId }: GroupDetailsDialogProps) {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { fetchConversations } = useConversations()

    const [group, setGroup] = useState<GroupInfo | null>(null)
    const [loading, setLoading] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editName, setEditName] = useState("")
    const [editDescription, setEditDescription] = useState("")
    const [saving, setSaving] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [showAddMembers, setShowAddMembers] = useState(false)
    const [nonMembers, setNonMembers] = useState<User[]>([])
    const [loadingNonMembers, setLoadingNonMembers] = useState(false)
    const [selectedNewMembers, setSelectedNewMembers] = useState<Set<string>>(new Set())
    const [addingMembers, setAddingMembers] = useState(false)

    const isOwner = group?.groupOwner?._id === user?._id
    const isAdmin = group?.groupAdmins?.some((a) => a._id === user?._id) || isOwner

    useEffect(() => {
        if (!open || !groupId) return

        const fetchGroup = async () => {
            setLoading(true)
            try {
                const data = await groupApi.get<GroupInfo>(groupId)
                setGroup(data)
                setEditName(data.groupName)
                setEditDescription(data.groupDescription || "")
            } catch (err) {
                toast.error("获取群组信息失败")
                onOpenChange(false)
            } finally {
                setLoading(false)
            }
        }

        fetchGroup()
    }, [open, groupId, onOpenChange])

    useEffect(() => {
        if (!open) {
            setGroup(null)
            setEditing(false)
            setShowAddMembers(false)
            setSelectedNewMembers(new Set())
        }
    }, [open])

    const handleSaveEdit = async () => {
        if (!group || !editName.trim()) return

        setSaving(true)
        try {
            const data = await groupApi.update(group._id, {
                name: editName.trim(),
                description: editDescription.trim() || undefined,
            }) as GroupInfo
            setGroup(data)
            setEditing(false)
            await fetchConversations()
            toast.success("群组信息已更新")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "更新失败")
        } finally {
            setSaving(false)
        }
    }

    const handleLeaveGroup = async () => {
        if (!group) return

        if (!confirm("确定要退出群组吗？")) return

        setLeaving(true)
        try {
            await groupApi.leave(group._id)
            await fetchConversations()
            onOpenChange(false)
            navigate("/user")
            toast.success("已退出群组")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "退出群组失败")
        } finally {
            setLeaving(false)
        }
    }

    const handleRemoveMember = async (memberId: string) => {
        if (!group) return

        if (!confirm("确定要移除该成员吗？")) return

        try {
            const data = await groupApi.removeMember(group._id, memberId) as GroupInfo
            if ((data as any).dissolved) {
                await fetchConversations()
                onOpenChange(false)
                navigate("/user")
                toast.success("群组已解散")
            } else {
                setGroup(data)
                await fetchConversations()
                toast.success("已移除成员")
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "移除成员失败")
        }
    }

    const handleSetAdmin = async (memberId: string, makeAdmin: boolean) => {
        if (!group) return

        try {
            const data = await groupApi.setAdmin(group._id, memberId, makeAdmin) as GroupInfo
            setGroup(data)
            toast.success(makeAdmin ? "已设为管理员" : "已取消管理员")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "操作失败")
        }
    }

    const handleTransferOwnership = async (newOwnerId: string) => {
        if (!group) return

        if (!confirm("确定要将群主转让给该成员吗？此操作不可撤销。")) return

        try {
            const data = await groupApi.transferOwnership(group._id, newOwnerId) as GroupInfo
            setGroup(data)
            toast.success("已转让群主")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "转让失败")
        }
    }

    const fetchNonMembers = async () => {
        if (!group) return

        setLoadingNonMembers(true)
        try {
            const data = await userApi.getNonFriends({ limit: 50 }) as { users: User[] }
            const memberIds = new Set(group.members.map((m) => m._id))
            const available = data.users.filter((u) => !memberIds.has(u._id))
            setNonMembers(available)
        } catch {
            toast.error("获取用户列表失败")
        } finally {
            setLoadingNonMembers(false)
        }
    }

    const handleAddMembers = async () => {
        if (!group || selectedNewMembers.size === 0) return

        setAddingMembers(true)
        try {
            const data = await groupApi.addMembers(group._id, Array.from(selectedNewMembers)) as GroupInfo
            setGroup(data)
            setSelectedNewMembers(new Set())
            setShowAddMembers(false)
            await fetchConversations()
            toast.success("已添加成员")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "添加成员失败")
        } finally {
            setAddingMembers(false)
        }
    }

    const toggleNewMember = (userId: string) => {
        setSelectedNewMembers((prev) => {
            const next = new Set(prev)
            if (next.has(userId)) {
                next.delete(userId)
            } else {
                next.add(userId)
            }
            return next
        })
    }

    const processedMembers: (GroupMember & { isOwner: boolean; isAdmin: boolean })[] = group?.members.map((m) => ({
        ...m,
        isOwner: m._id === group.groupOwner?._id,
        isAdmin: group.groupAdmins?.some((a) => a._id === m._id) || false,
    })) || []

    const sortedMembers = processedMembers.sort((a, b) => {
        if (a.isOwner) return -1
        if (b.isOwner) return 1
        if (a.isAdmin && !b.isAdmin) return -1
        if (!a.isAdmin && b.isAdmin) return 1
        return 0
    })

    if (!open) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-4">
                        <div className="flex justify-center">
                            <Skeleton className="size-20 rounded-full" />
                        </div>
                        <Skeleton className="h-6 w-1/2 mx-auto" />
                        <Skeleton className="h-4 w-3/4 mx-auto" />
                    </div>
                ) : showAddMembers ? (
                    <>
                        <DialogHeader className="px-4 pt-6 pb-3 border-b">
                            <DialogTitle className="flex items-center gap-2">
                                <UserPlus className="size-5" />
                                添加成员
                            </DialogTitle>
                        </DialogHeader>

                        <ScrollArea className="h-[300px]">
                            <div className="p-2 space-y-0.5">
                                {loadingNonMembers ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : nonMembers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                        <Users className="size-8 opacity-30 mb-2" />
                                        <p className="text-sm">暂无可添加的用户</p>
                                    </div>
                                ) : (
                                    nonMembers.map((u) => (
                                        <button
                                            key={u._id}
                                            onClick={() => toggleNewMember(u._id)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-accent/60"
                                        >
                                            <div className="relative shrink-0">
                                                <Avatar className="size-10">
                                                    <AvatarImage src={u.profilePic} />
                                                    <AvatarFallback className="bg-primary/15 text-xs font-semibold">
                                                        {initials(u.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {selectedNewMembers.has(u._id) && (
                                                    <div className="absolute -top-1 -right-1 size-5 rounded-full bg-primary flex items-center justify-center">
                                                        <Check className="size-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="flex-1 truncate text-sm font-medium">{u.name}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </ScrollArea>

                        <div className="flex justify-end gap-2 p-4 border-t">
                            <Button variant="outline" onClick={() => setShowAddMembers(false)}>
                                取消
                            </Button>
                            <Button
                                onClick={handleAddMembers}
                                disabled={addingMembers || selectedNewMembers.size === 0}
                            >
                                {addingMembers ? (
                                    <Loader2 className="size-4 animate-spin mr-2" />
                                ) : null}
                                添加 ({selectedNewMembers.size})
                            </Button>
                        </div>
                    </>
                ) : group && (
                    <>
                        <div className="relative">
                            <div className="flex flex-col items-center pt-6 pb-4 px-4 bg-gradient-to-b from-primary/5 to-transparent">
                                <div className="ring-4 ring-background shadow-lg rounded-xl overflow-hidden">
                                    <GroupAvatar members={group.members} size={80} />
                                </div>

                                {editing ? (
                                    <div className="w-full max-w-xs mt-4 space-y-2">
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            placeholder="群组名称"
                                            className="text-center h-9"
                                            maxLength={50}
                                        />
                                        <Textarea
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            placeholder="群组简介"
                                            className="min-h-[60px] resize-none text-center"
                                            maxLength={200}
                                        />
                                        <div className="flex justify-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setEditing(false)}
                                                disabled={saving}
                                            >
                                                取消
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handleSaveEdit}
                                                disabled={saving || !editName.trim()}
                                            >
                                                {saving && <Loader2 className="size-3 animate-spin mr-1" />}
                                                保存
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-lg font-semibold mt-3">{group.groupName}</h2>
                                        {group.groupDescription && (
                                            <p className="text-sm text-muted-foreground text-center mt-1 max-w-xs">
                                                {group.groupDescription}
                                            </p>
                                        )}
                                        {isAdmin && !editing && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="mt-2"
                                                onClick={() => setEditing(true)}
                                            >
                                                <Edit2 className="size-3.5 mr-1" />
                                                编辑信息
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="px-4 py-2 border-t border-b bg-muted/30 flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                {group.members.length} 位成员
                            </span>
                            {isAdmin && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setShowAddMembers(true)
                                        fetchNonMembers()
                                    }}
                                >
                                    <UserPlus className="size-3.5 mr-1" />
                                    添加成员
                                </Button>
                            )}
                        </div>

                        <ScrollArea className="h-[250px]">
                            <div className="p-2 space-y-0.5">
                                {sortedMembers.map((member) => (
                                    <div
                                        key={member._id}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/40"
                                    >
                                        <Avatar className="size-10">
                                            <AvatarImage src={member.profilePic} />
                                            <AvatarFallback className="bg-primary/15 text-xs font-semibold">
                                                {initials(member.name)}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="truncate text-sm font-medium">
                                                    {member.name}
                                                    {member._id === user?._id && " (我)"}
                                                </span>
                                                {member.isOwner && (
                                                    <Badge variant="default" className="h-5 px-1.5 text-[10px] gap-0.5">
                                                        <Crown className="size-2.5" />
                                                        群主
                                                    </Badge>
                                                )}
                                                {!member.isOwner && member.isAdmin && (
                                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-0.5">
                                                        <Shield className="size-2.5" />
                                                        管理员
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {isOwner && !member.isOwner && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="size-8">
                                                        <Settings className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-36">
                                                    <DropdownMenuItem onClick={() => handleSetAdmin(member._id, !member.isAdmin)}>
                                                        {member.isAdmin ? (
                                                            <>
                                                                <ShieldOff className="size-4 mr-2" />
                                                                取消管理员
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Shield className="size-4 mr-2" />
                                                                设为管理员
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleTransferOwnership(member._id)}>
                                                        <Crown className="size-4 mr-2" />
                                                        转让群主
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleRemoveMember(member._id)}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <UserMinus className="size-4 mr-2" />
                                                        移除成员
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}

                                        {isAdmin && !isOwner && !member.isOwner && !member.isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 text-destructive hover:text-destructive"
                                                onClick={() => handleRemoveMember(member._id)}
                                            >
                                                <UserMinus className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t">
                            <Button
                                variant="destructive"
                                className="w-full"
                                onClick={handleLeaveGroup}
                                disabled={leaving}
                            >
                                {leaving ? (
                                    <Loader2 className="size-4 animate-spin mr-2" />
                                ) : (
                                    <LogOut className="size-4 mr-2" />
                                )}
                                退出群组
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
