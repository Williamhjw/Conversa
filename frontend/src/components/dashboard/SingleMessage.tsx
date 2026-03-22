import { useState, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Copy, Trash2, Check, CheckCheck, CheckCircle2, Circle, Star, Reply, Languages } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Message, SenderInfo } from "@/hooks/use-chat"
import { Button } from "../ui/button"
import { useNavigate } from "react-router-dom"
import { messageApi } from "@/lib/api"
import { toast } from "sonner"
import { Spinner } from "../ui/spinner"

interface Props {
    message: Message
    isMine: boolean
    isBot?: boolean
    receiverId: string
    myId: string
    receiverName: string
    onDelete: (messageId: string, scope: "me" | "everyone") => void
    onStar: (messageId: string) => void
    onReply: (message: Message) => void
    // select-mode props
    selectMode?: boolean
    selected?: boolean
    onToggleSelect?: (id: string) => void
    // highlight / jump-to
    highlighted?: boolean
    // group chat props
    isGroup?: boolean
    groupMembers?: Array<{ _id: string; name: string; profilePic?: string }>
}

function formatTime(dateStr: string): string {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
    if (d.toDateString() === yesterday.toDateString()) {
        return `昨天 ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function SingleMessage({ message, isMine, isBot, receiverId, myId, receiverName, onDelete, onStar, onReply, selectMode, selected, onToggleSelect, highlighted, isGroup, groupMembers }: Props) {
    const [hovered, setHovered] = useState(false)
    const [copied, setCopied] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [translating, setTranslating] = useState(false)
    const [translatedText, setTranslatedText] = useState<string | null>(null)
    const [showTranslation, setShowTranslation] = useState(false)
    const navigate = useNavigate()
    const isTouchDevice = useRef(false)
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longPressTriggered = useRef(false)

    const isStarred = message.starredBy?.includes(myId)

    // Get sender info for group chat
    const getSenderInfo = () => {
        if (typeof message.senderId === 'string') {
            // If senderId is just a string, look up in groupMembers
            if (isGroup && groupMembers) {
                const member = groupMembers.find(m => m._id === message.senderId)
                if (member) return member
            }
            return { name: '未知用户', profilePic: undefined }
        }
        // If senderId is populated with SenderInfo
        return message.senderId as SenderInfo
    }

    const senderInfo = getSenderInfo()

    const handleCopy = () => {
        if (message.text) {
            navigator.clipboard.writeText(message.text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        }
    }

    const handleTranslate = async () => {
        if (!message.text || translating) return
        
        if (translatedText) {
            setShowTranslation(!showTranslation)
            return
        }

        setTranslating(true)
        try {
            const result = await messageApi.translate(message.text)
            setTranslatedText(result.translatedText)
            setShowTranslation(true)
        } catch {
            toast.error("翻译失败，请稍后重试")
        } finally {
            setTranslating(false)
        }
    }

    const handleTouchStart = () => {
        isTouchDevice.current = true
        if (selectMode) return
        longPressTriggered.current = false
        longPressTimer.current = setTimeout(() => {
            longPressTriggered.current = true
            setHovered(true)
        }, 500)
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
        if (selectMode) {
            e.preventDefault()
            onToggleSelect?.(message._id)
        } else if (longPressTriggered.current) {
            longPressTriggered.current = false
        } else if (hovered) {
            e.preventDefault()
            setHovered(false)
        }
    }

    const handleTouchMove = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }

    const handleToolbarTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setHovered(false)
    }

    const handleMouseEnter = () => {
        if (isTouchDevice.current) return
        if (!selectMode) setHovered(true)
    }

    const handleMouseLeave = () => {
        if (isTouchDevice.current) return
        if (!selectMode) setHovered(false)
    }

    // Get initials for avatar fallback
    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <>
            <div
                data-message-id={message._id}
                className={cn(
                    "group flex gap-2",
                    isMine ? "ml-auto flex-row-reverse" : isBot ? "mr-auto" : "mr-auto",
                    selectMode && "cursor-pointer",
                    selectMode && selected && (isMine ? "pr-2" : "pl-2")
                )}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
            >
                {/* Checkbox indicator in select mode */}
                {selectMode && (
                    <div className="flex items-center shrink-0">
                        {selected
                            ? <CheckCircle2 className="size-5 text-primary" />
                            : <Circle className="size-5 text-muted-foreground" />}
                    </div>
                )}
                {/* Avatar for group chat - show for other users' messages */}
                {!isMine && !isBot && isGroup && (
                    <div className="shrink-0 self-start">
                        <Avatar className="size-8">
                            <AvatarImage src={senderInfo.profilePic} alt={senderInfo.name} />
                            <AvatarFallback className="bg-primary/15 text-xs font-semibold">
                                {getInitials(senderInfo.name)}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                )}
                <div className={cn(
                    "flex flex-col gap-0.5",
                    isMine ? "max-w-[75%]" : isBot ? "max-w-[85%]" : isGroup ? "max-w-[calc(100%-48px)]" : "max-w-[75%]"
                )}>
                    {/* Sender name for group chat */}
                    {!isMine && !isBot && isGroup && (
                        <span className="text-xs text-muted-foreground ml-1">{senderInfo.name}</span>
                    )}
                    {/* Bubble */}
                <div
                    className={cn(
                        "relative px-3.5 py-2 text-sm shadow-sm transition-shadow",
                        isMine
                            ? "bg-primary text-white rounded-2xl rounded-br-sm"
                            : "bg-muted text-foreground rounded-2xl",
                        !isMine && isGroup && "rounded-tl-sm",
                        !isMine && !isGroup && "rounded-bl-sm",
                        highlighted && "animate-highlight"
                    )}
                >
                    {/* Reply preview — shown when this message is a reply to another */}
                    {message.replyTo && !message.softDeleted && (
                        <div
                            onClick={() => { navigate(`/user/conversations/${message.conversationId}?highlight=${message.replyTo?._id}`) }}
                            className={cn(
                                "my-2 px-2 py-1 rounded border-l-2 text-xs space-y-0.5 max-w-full cursor-pointer",
                                isMine
                                    ? "border-white/50 bg-white/10"
                                    : "border-primary/50 bg-primary/5 dark:bg-primary/10"

                            )}>
                            <p className={cn("font-semibold truncate", isMine ? "text-white/80" : "text-primary")}>
                                {typeof message.replyTo.senderId === 'string' 
                                    ? (message.replyTo.senderId === myId ? "你" : receiverName)
                                    : (message.replyTo.senderId._id === myId ? "你" : receiverName)}
                            </p>
                            <p className={cn("truncate", isMine ? "text-white/60" : "text-muted-foreground")}>
                                {message.replyTo.softDeleted
                                    ? "此消息已删除"
                                    : message.replyTo.text || "🖼️ 图片"}
                            </p>
                        </div>
                    )}
                    {/* Tombstone for soft-deleted messages */}
                    {message.softDeleted ? (
                        <p className="text-xs italic opacity-60 leading-relaxed select-none">
                            此消息已删除
                        </p>
                    ) : (
                        <>
                            {message.imageUrl && (
                                <img
                                    src={message.imageUrl}
                                    alt="图片"
                                    className="max-w-60 max-h-80 rounded-lg mb-1 object-cover"
                                />
                            )}
                            {message.text && (
                                isBot && !isMine ? (
                                    <div className="text-sm leading-relaxed break-all prose prose-sm max-w-none
                                    prose-p:my-1 prose-p:leading-relaxed
                                    prose-headings:font-semibold prose-headings:my-1
                                    prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
                                    prose-ul:my-1 prose-ul:pl-4
                                    prose-ol:my-1 prose-ol:pl-4
                                    prose-li:my-0
                                    prose-pre:bg-black/10 prose-pre:rounded prose-pre:px-2 prose-pre:py-1 prose-pre:text-xs prose-pre:my-1
                                    prose-code:bg-black/10 prose-code:rounded prose-code:px-1 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                                    prose-blockquote:border-l-2 prose-blockquote:pl-2 prose-blockquote:my-1 prose-blockquote:text-muted-foreground
                                    prose-strong:font-semibold
                                    prose-a: prose-a:underline
                                    dark:prose-invert">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {message.text}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="leading-relaxed whitespace-pre-wrap break-all">{message.text}</p>
                                )
                            )}
                            {showTranslation && translatedText && (
                                <div className={cn(
                                    "mt-2 pt-2 border-t text-xs",
                                    isMine ? "border-white/20 text-white/80" : "border-border text-muted-foreground"
                                )}>
                                    <p className="font-medium mb-0.5">中文翻译：</p>
                                    <p className="whitespace-pre-wrap break-all">{translatedText}</p>
                                </div>
                            )}
                        </>
                    )}
                    <span
                        className={cn(
                            "flex items-center justify-end gap-1 text-[10px] mt-0.5 leading-none",
                            isMine ? "text-white/60" : "text-muted-foreground"
                        )}
                    >
                        {formatTime(message.createdAt)}
                        {isMine && (() => {
                            const seen = message.seenBy?.some((s) => s.user === receiverId)
                            return seen
                                ? <CheckCheck className="size-3 text-sky-300 shrink-0" />
                                : <Check className="size-3 shrink-0" />
                        })()}
                    </span>
                </div>
                </div>

                {/* Hover action buttons — hidden in select mode or for tombstones (no copy; only hide if mine) */}
                {!selectMode && (
                    <div
                        className={cn(
                            "flex items-center gap-1 transition-opacity duration-150",
                            "md:hover:opacity-100 md:hover:pointer-events-auto",
                            hovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                        )}
                        onClick={(e) => {
                            e.stopPropagation()
                            setHovered(false)
                        }}
                        onTouchEnd={handleToolbarTouchEnd}
                    >
                        {/* Reply button — always available except for tombstones */}
                        {!message.softDeleted && !selectMode && (
                            <Button
                                size={"icon"}
                                variant={"secondary"}
                                onClick={(e) => { e.stopPropagation(); onReply(message) }}
                                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); onReply(message) }}
                                title="回复"
                                className="flex items-center justify-center size-7 rounded-full"
                            >
                                <Reply className="size-3.5" />
                            </Button>
                        )}
                        {!message.softDeleted && (
                            <Button
                                size={"icon"}
                                variant={"secondary"}
                                onClick={(e) => { e.stopPropagation(); onStar(message._id) }}
                                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); onStar(message._id) }}
                                title={isStarred ? "取消收藏" : "收藏"}
                                className={cn(
                                    "flex items-center justify-center size-7 rounded-full",
                                    isStarred && "text-yellow-400"
                                )}
                            >
                                <Star className={cn("size-3.5", isStarred && "fill-yellow-400")} />
                            </Button>
                        )}
                        {message.text && !message.softDeleted && (
                            <Button
                                size={"icon"}
                                variant={"secondary"}
                                onClick={(e) => { e.stopPropagation(); handleCopy() }}
                                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); handleCopy() }}
                                title="复制"
                                className="flex items-center justify-center size-7 rounded-full"
                            >
                                {copied
                                    ? <Check className="size-3.5 text-green-500" />
                                    : <Copy className="size-3.5" />
                                }
                            </Button>
                        )}
                        {message.text && !message.softDeleted && (
                            <Button
                                size={"icon"}
                                variant={"secondary"}
                                onClick={(e) => { e.stopPropagation(); handleTranslate() }}
                                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); handleTranslate() }}
                                title={showTranslation ? "隐藏翻译" : "翻译成中文"}
                                className={cn(
                                    "flex items-center justify-center size-7 rounded-full",
                                    showTranslation && "text-primary"
                                )}
                                disabled={translating}
                            >
                                {translating
                                    ? <Spinner className="size-3.5" />
                                    : <Languages className="size-3.5" />
                                }
                            </Button>
                        )}
                        {(!message.softDeleted || isMine) && (
                            <Button
                                size={"icon"}
                                variant={"destructive"}
                                onClick={(e) => { e.stopPropagation(); setDeleteOpen(true) }}
                                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setDeleteOpen(true) }}
                                title="删除"
                                className="flex items-center justify-center size-7 rounded-full"
                            >
                                <Trash2 className="size-3.5 text-muted-foreground group-hover:text-inherit" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Delete Dialog */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除消息</AlertDialogTitle>
                        <AlertDialogDescription>
                            {message.softDeleted
                                ? "此消息已为所有人删除。是否从您的视图中移除？"
                                : "选择您要如何删除此消息。"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-col gap-2">
                        {isMine && !message.softDeleted && (
                            <AlertDialogAction
                                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => { setDeleteOpen(false); onDelete(message._id, "everyone") }}
                            >
                                为所有人删除
                            </AlertDialogAction>
                        )}
                        <AlertDialogAction
                            className="w-full"
                            onClick={() => { setDeleteOpen(false); onDelete(message._id, "me") }}
                        >
                            为我删除
                        </AlertDialogAction>
                        <AlertDialogCancel className="w-full mt-0">取消</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
