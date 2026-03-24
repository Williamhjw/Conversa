import { useState, useRef, useCallback, useEffect } from "react"
import { ArrowRight, ImagePlus, ShieldX, X, Sparkles, Loader2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { emitSendMessage, emitTyping, emitStopTyping } from "@/lib/socket"
import { API_BASE } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Message } from "@/hooks/use-chat"

interface Props {
    conversationId: string
    myId: string
    receiverId: string
    receiverName?: string
    isReceiverBot?: boolean
    isBlocked?: boolean
    blockedByThem?: boolean
    replyToMessage?: Message | null
    onCancelReply?: () => void
}

const STOP_TYPING_DELAY = 1500

export default function MessageInput({ conversationId, myId, receiverId, receiverName, isReceiverBot, isBlocked, blockedByThem, replyToMessage, onCancelReply }: Props) {
    const [text, setText] = useState("")
    const [uploading, setUploading] = useState(false)
    const [imageDialogOpen, setImageDialogOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [caption, setCaption] = useState("")
    
    // Image generation mode state
    const [isImageGenMode, setIsImageGenMode] = useState(false)
    const [imageGenLoading, setImageGenLoading] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isTypingRef = useRef(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const emitStopTypingNow = useCallback(() => {
        if (isTypingRef.current) {
            isTypingRef.current = false
            emitStopTyping({ conversationId, typer: myId, receiverId })
        }
    }, [conversationId, myId, receiverId])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearTimeout(stopTypingTimer.current!)
            emitStopTypingNow()
        }
    }, [emitStopTypingNow])

    // Auto-focus when the conversation changes
    useEffect(() => {
        textareaRef.current?.focus()
    }, [conversationId])

    // Auto-focus when a reply is set so the user can type right away
    useEffect(() => {
        if (replyToMessage) textareaRef.current?.focus()
    }, [replyToMessage])

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value)

        if (!isTypingRef.current) {
            isTypingRef.current = true
            emitTyping({ conversationId, typer: myId, receiverId })
        }

        clearTimeout(stopTypingTimer.current!)
        stopTypingTimer.current = setTimeout(emitStopTypingNow, STOP_TYPING_DELAY)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            if (isImageGenMode) {
                handleGenerateImage()
            } else {
                handleSendText()
            }
        }
    }

    const handleSendText = () => {
        const trimmed = text.trim()
        if (!trimmed) return
        clearTimeout(stopTypingTimer.current!)
        emitStopTypingNow()
        emitSendMessage({ conversationId, text: trimmed, replyTo: replyToMessage?._id ?? null })
        setText("")
        onCancelReply?.()
        textareaRef.current?.focus()
    }

    // Toggle image generation mode
    const toggleImageGenMode = () => {
        setIsImageGenMode(!isImageGenMode)
        setText("")
        textareaRef.current?.focus()
    }

    // Generate image and send as bot message
    const handleGenerateImage = async () => {
        const prompt = text.trim()
        if (!prompt) {
            toast.error("请输入图片描述")
            return
        }

        // Send user prompt message first
        clearTimeout(stopTypingTimer.current!)
        emitStopTypingNow()
        emitSendMessage({ 
            conversationId, 
            text: `🎨 生成图片：${prompt}`, 
            replyTo: replyToMessage?._id ?? null 
        })
        setText("")
        onCancelReply?.()

        // Start generating
        setImageGenLoading(true)
        
        try {
            const token = localStorage.getItem("auth-token")
            const response = await fetch(`${API_BASE}/image/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "auth-token": token || "",
                },
                body: JSON.stringify({
                    prompt: prompt,
                    size: "1024x1024",
                    n: 1,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || "图片生成失败")
            }

            const data = await response.json()
            if (data.success && data.images && data.images.length > 0) {
                const imageUrl = data.images[0].url
                // Send the generated image as a bot message through socket
                emitSendMessage({ 
                    conversationId, 
                    imageUrl: imageUrl, 
                    text: `✨ 已为您生成图片\n📝 描述：${prompt}`,
                    replyTo: null
                })
                // Auto exit image generation mode after successful generation
                setIsImageGenMode(false)
            } else {
                throw new Error("图片生成返回数据异常")
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "图片生成失败")
            // Send error message as bot
            emitSendMessage({ 
                conversationId, 
                text: "❌ 图片生成失败，请稍后重试",
                replyTo: null
            })
            // Auto exit image generation mode even on error
            setIsImageGenMode(false)
        } finally {
            setImageGenLoading(false)
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            toast.error("仅支持图片文件。")
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("图片大小不能超过 5 MB。")
            return
        }
        setSelectedFile(file)
        setPreviewUrl(URL.createObjectURL(file))
        setImageDialogOpen(true)
        e.target.value = ""
    }

    const handleSendImage = async () => {
        if (!selectedFile) return
        setUploading(true)
        try {
            const formData = new FormData()
            formData.append("image", selectedFile)

            const token = localStorage.getItem("auth-token")
            const uploadRes = await fetch(`${API_BASE}/upload`, {
                method: "POST",
                headers: {
                    "auth-token": token || "",
                },
                body: formData,
            })

            if (!uploadRes.ok) {
                const errorData = await uploadRes.json().catch(() => ({}))
                throw new Error(errorData.error || "上传失败")
            }

            const { url } = await uploadRes.json()
            const imageUrl = url
            const trimmedCaption = caption.trim()
            emitSendMessage({ conversationId, imageUrl, ...(trimmedCaption && { text: trimmedCaption }), replyTo: replyToMessage?._id ?? null })
            onCancelReply?.()
            closeImageDialog()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "发送图片失败。")
        } finally {
            setUploading(false)
        }
    }

    const closeImageDialog = () => {
        setImageDialogOpen(false)
        setSelectedFile(null)
        setCaption("")
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
    }

    return (
        <>
            {(isBlocked || blockedByThem) ? (
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-t bg-background text-muted-foreground text-sm">
                    <ShieldX className="size-4 shrink-0" />
                    <span>
                        {isBlocked
                            ? "您已屏蔽该用户。解除屏蔽后才能发送消息。"
                            : "您无法向该用户发送消息。"}
                    </span>
                </div>
            ) : (
            <div className="border-t bg-background">
                {/* Reply strip */}
                {replyToMessage && (
                    <div className="flex items-center gap-3 px-4 pt-2.5 pb-1">
                        <div className="flex-1 min-w-0 pl-2 border-l-2 border-primary">
                            <p className="text-xs font-semibold text-primary truncate">
                                回复 {typeof replyToMessage.senderId === 'string' 
                                    ? (replyToMessage.senderId === myId ? "自己" : (receiverName || "对方"))
                                    : (replyToMessage.senderId._id === myId ? "自己" : (receiverName || "对方"))}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {replyToMessage.softDeleted
                                    ? "此消息已删除"
                                    : replyToMessage.text || "🖼️ 图片"}
                            </p>
                        </div>
                        <button
                            onClick={onCancelReply}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            title="取消回复"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                )}

                {/* Mode indicator */}
                {isReceiverBot && isImageGenMode && (
                    <div className="flex items-center gap-2 px-4 pt-2 pb-1">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                            <Sparkles className="size-3.5" />
                            图片生成模式
                        </div>
                        <span className="text-xs text-muted-foreground">
                            输入描述，AI将为您生成图片
                        </span>
                    </div>
                )}

                <div className="flex items-end gap-2 p-3">
                {/* Image upload button - only for normal users */}
                {!isReceiverBot && (<><Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    title="发送图片"
                >
                    <ImagePlus className="size-5" />
                </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                    /></>)}

                {/* AI Image generation toggle button - only for bot */}
                {isReceiverBot && (
                    <Button
                        type="button"
                        variant={isImageGenMode ? "default" : "ghost"}
                        size="lg"
                        className={cn(
                            "shrink-0 transition-all duration-200",
                            isImageGenMode 
                                ? "bg-purple-500 hover:bg-purple-600 text-white" 
                                : "text-purple-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                        )}
                        onClick={toggleImageGenMode}
                        title={isImageGenMode ? "退出图片生成模式" : "进入图片生成模式"}
                        disabled={imageGenLoading}
                    >
                        {isImageGenMode ? <MessageSquare className="size-5" /> : <Sparkles className="size-5" />}
                    </Button>
                )}

                {/* Text area */}
                <Textarea
                    ref={textareaRef}
                    placeholder={isImageGenMode ? "描述你想要生成的图片..." : "输入消息…"}
                    className={cn(
                        "flex-1 min-h-10 max-h-36 resize-none text-base rounded-xl thin-scrollbar transition-all duration-200",
                        isImageGenMode && "border-purple-300 dark:border-purple-700 focus-visible:ring-purple-500"
                    )}
                    rows={1}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={imageGenLoading}
                />

                {/* Send button */}
                <Button
                    type="button"
                    size="lg"
                    className={cn(
                        "shrink-0 hover:bg-primary/90 text-white rounded-xl transition-all duration-200",
                        isImageGenMode && "bg-purple-500 hover:bg-purple-600"
                    )}
                    onClick={isImageGenMode ? handleGenerateImage : handleSendText}
                    disabled={!text.trim() || imageGenLoading}
                    title={isImageGenMode ? "生成图片" : "发送"}
                >
                    {imageGenLoading ? (
                        <Loader2 className="size-5 animate-spin" />
                    ) : (
                        <ArrowRight className="size-5" />
                    )}
                </Button>
                </div>
            </div>
            )}

            {/* Image preview dialog */}
            <Dialog open={imageDialogOpen} onOpenChange={(open) => { if (!open) closeImageDialog() }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>发送图片</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center rounded-lg overflow-hidden bg-muted max-h-80">
                        {previewUrl && (
                            <img
                                src={previewUrl}
                                alt="预览"
                                className="max-h-80 object-contain"
                            />
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate text-center">{selectedFile?.name}</p>

                    {/* Caption input */}
                    <Textarea
                        placeholder="添加说明… (可选)"
                        className={cn(
                            "resize-none text-sm min-h-10 max-h-28 thin-scrollbar",
                        )}
                        rows={1}
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                if (!uploading) handleSendImage()
                            }
                        }}
                        disabled={uploading}
                        autoFocus
                    />

                    <div className="flex flex-row justify-end gap-2">
                        <Button variant="outline" onClick={closeImageDialog} disabled={uploading} className="flex-1 sm:flex-none">
                            取消
                        </Button>
                        <Button
                            className="bg-primary hover:bg-primary/90 text-white flex-1 sm:flex-none"
                            onClick={handleSendImage}
                            disabled={uploading}
                        >
                            {uploading ? <Spinner className="size-4 mr-1" /> : ""}
                            {uploading ? "发送中…" : "发送"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
