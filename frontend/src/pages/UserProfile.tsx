
import { useState, useRef } from "react"
import { Camera, Pencil, Check, X, Eye, EyeOff, Loader2, Trash2, Sun, Moon, Monitor } from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { userApi } from "@/lib/api"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
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

/* ─── localStorage keys ─────────────────────────────────────────────────── */
export const LS_NOTIF_BANNERS = "notif-banners-enabled"
export const LS_NOTIF_SOUND = "notif-sound-enabled"

const getStoredBool = (key: string, fallback = true): boolean => {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === "true"
}

/* ─── inline-editable field ─────────────────────────────────────────────── */
function EditableField({
    label,
    value,
    onSave,
    multiline = false,
}: {
    label: string
    value: string
    onSave: (v: string) => Promise<void>
    multiline?: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (draft.trim() === value) { setEditing(false); return }
        setSaving(true)
        try {
            await onSave(draft.trim())
            setEditing(false)
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => { setDraft(value); setEditing(false) }

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
                {!editing && (
                    <button
                        onClick={() => { setDraft(value); setEditing(true) }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Pencil className="size-3.5" />
                    </button>
                )}
            </div>

            {editing ? (
                <div className="flex gap-2 items-start">
                    {multiline ? (
                        <textarea
                            autoFocus
                            rows={3}
                            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                        />
                    ) : (
                        <Input
                            autoFocus
                            className="flex-1"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel() }}
                        />
                    )}
                    <div className="flex gap-1">
                        <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="rounded-md p-1.5 bg-muted text-muted-foreground hover:bg-muted/80"
                        >
                            <X className="size-3.5" />
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-md p-1.5 text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-sm whitespace-pre-wrap wrap-break-word">{value || <span className="text-muted-foreground italic">未设置</span>}</p>
            )}
        </div>
    )
}

/* ─── password field with show/hide ────────────────────────────────────── */
function PasswordInput({
    id,
    label,
    value,
    onChange,
    placeholder,
}: {
    id: string
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
}) {
    const [show, setShow] = useState(false)
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
                <Input
                    id={id}
                    type={show ? "text" : "password"}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="pr-10"
                />
                <button
                    type="button"
                    onClick={() => setShow((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
            </div>
        </div>
    )
}

/* ─── main page ─────────────────────────────────────────────────────────── */
const UserProfile = () => {
    const { user, setUser, logout } = useAuth()
    const { theme, setTheme } = useTheme()
    const navigate = useNavigate()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [avatarUploading, setAvatarUploading] = useState(false)

    // password-change form
    const [oldPassword, setOldPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirm] = useState("")
    const [pwSaving, setPwSaving] = useState(false)

    // notification preferences
    const [bannersEnabled, setBannersEnabled] = useState(() => getStoredBool(LS_NOTIF_BANNERS))
    const [soundEnabled, setSoundEnabled] = useState(() => getStoredBool(LS_NOTIF_SOUND))
    const [emailNotifsEnabled, setEmailNotifsEnabled] = useState(
        () => user?.emailNotificationsEnabled ?? true
    )
    const [emailNotifsLoading, setEmailNotifsLoading] = useState(false)

    // delete account dialog
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState("")
    const [deleting, setDeleting] = useState(false)

    if (!user) return null

    const initials = user.name
        ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : "?"

    const hasCustomPhoto = user.profilePic && !user.profilePic.includes("ui-avatars.com")

    /* ── profile-pic remove ─────────────────────────────────────────────── */
    const handleRemoveAvatar = async () => {
        const defaultUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&bold=true`
        setAvatarUploading(true)
        try {
            await userApi.updateProfile({ profilePic: defaultUrl })
            setUser({ ...user, profilePic: defaultUrl })
            toast.success("头像已移除")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "移除头像失败")
        } finally {
            setAvatarUploading(false)
        }
    }

    /* ── profile-pic upload ─────────────────────────────────────────────── */
    const handleAvatarChange = async (file: File) => {
        if (!file.type.startsWith("image/")) { toast.error("请选择图片文件"); return }
        setAvatarUploading(true)
        try {
            const { token, key, domain } = await userApi.getPresignedUrl(file.name, file.type) as { token: string; key: string; domain: string }

            const form = new FormData()
            form.append("token", token)
            form.append("key", key)
            form.append("file", file)

            const upload = await fetch("https://upload.qiniup.com", { method: "POST", body: form })
            if (!upload.ok) throw new Error("Upload failed")

            const imageUrl = `${domain}/${key}`

            await userApi.updateProfile({ profilePic: imageUrl })
            setUser({ ...user, profilePic: imageUrl })
            toast.success("头像已更新")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "上传失败")
        } finally {
            setAvatarUploading(false)
        }
    }

    /* ── name / about save ──────────────────────────────────────────────── */
    const handleSaveName = async (name: string) => {
        await userApi.updateProfile({ name })
        setUser({ ...user, name })
        toast.success("姓名已更新")
    }

    const handleSaveAbout = async (about: string) => {
        await userApi.updateProfile({ about })
        setUser({ ...user, about })
        toast.success("简介已更新")
    }

    /* ── password change ────────────────────────────────────────────────── */
    const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!oldPassword || !newPassword || !confirmPassword) {
            toast.error("请填写所有密码字段"); return
        }
        if (newPassword !== confirmPassword) {
            toast.error("两次输入的新密码不一致"); return
        }
        if (newPassword.length < 6) {
            toast.error("密码至少需要6个字符"); return
        }
        setPwSaving(true)
        try {
            await userApi.updateProfile({ oldpassword: oldPassword, newpassword: newPassword })
            toast.success("密码修改成功")
            setOldPassword(""); setNewPassword(""); setConfirm("")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "修改密码失败")
        } finally {
            setPwSaving(false)
        }
    }

    /* ── notification toggles ───────────────────────────────────────────── */
    const toggleBanners = (val: boolean) => {
        setBannersEnabled(val)
        localStorage.setItem(LS_NOTIF_BANNERS, String(val))
    }

    const toggleSound = (val: boolean) => {
        setSoundEnabled(val)
        localStorage.setItem(LS_NOTIF_SOUND, String(val))
    }

    const toggleEmailNotifs = async (val: boolean) => {
        setEmailNotifsEnabled(val)
        setEmailNotifsLoading(true)
        try {
            await userApi.updateProfile({ emailNotificationsEnabled: val })
            setUser({ ...user, emailNotificationsEnabled: val })
        } catch (err) {
            setEmailNotifsEnabled(!val)
            toast.error(err instanceof Error ? err.message : "更新邮件通知设置失败")
        } finally {
            setEmailNotifsLoading(false)
        }
    }

    /* ── logout ─────────────────────────────────────────────────────────── */
    const handleLogout = () => {
        logout()
        navigate("/login")
    }

    /* ── delete account ─────────────────────────────────────────────────── */
    const handleDeleteAccount = async () => {
        setDeleting(true)
        try {
            await userApi.deleteAccount()
            toast.success("账户已删除")
            logout()
            navigate("/login")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "删除账户失败")
        } finally {
            setDeleting(false)
            setDeleteDialogOpen(false)
        }
    }

    return (
        <>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-xl mx-auto space-y-6">

                {/* ── Profile card ──────────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>个人资料</CardTitle>
                        <CardDescription>您的公开信息</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex justify-center">
                            <div className="relative group">
                                <Avatar className="size-24 text-lg">
                                    <AvatarImage src={user.profilePic} alt={user.name} />
                                    <AvatarFallback className="bg-primary/20  font-semibold text-xl">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {avatarUploading
                                        ? <Loader2 className="size-6 text-white animate-spin" />
                                        : (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={avatarUploading}
                                                    className="p-1 hover:scale-110 transition-transform"
                                                    title="上传头像"
                                                >
                                                    <Camera className="size-5 text-white" />
                                                </button>
                                                {hasCustomPhoto && (
                                                    <button
                                                        onClick={handleRemoveAvatar}
                                                        disabled={avatarUploading}
                                                        className="p-1 hover:scale-110 transition-transform"
                                                        title="移除头像"
                                                    >
                                                        <Trash2 className="size-5 text-white" />
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    }
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarChange(f); e.target.value = "" }}
                                />
                            </div>
                        </div>

                        <Separator />

                        <EditableField label="姓名" value={user.name} onSave={handleSaveName} />
                        <EditableField label="简介" value={user.about ?? ""} onSave={handleSaveAbout} multiline />
                    </CardContent>
                </Card>

                {/* ── Change Password card ───────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>修改密码</CardTitle>
                        <CardDescription>更新您的账户密码</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <PasswordInput
                                id="old-pw"
                                label="当前密码"
                                value={oldPassword}
                                onChange={setOldPassword}
                                placeholder="输入当前密码"
                            />
                            <PasswordInput
                                id="new-pw"
                                label="新密码"
                                value={newPassword}
                                onChange={setNewPassword}
                                placeholder="输入新密码"
                            />
                            <PasswordInput
                                id="confirm-pw"
                                label="确认新密码"
                                value={confirmPassword}
                                onChange={setConfirm}
                                placeholder="确认新密码"
                            />
                            <Button type="submit" disabled={pwSaving} className="w-full">
                                {pwSaving ? <><Loader2 className="size-4 mr-2 animate-spin" /> 保存中…</> : "修改密码"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* ── Appearance card ───────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>外观</CardTitle>
                        <CardDescription>
                            选择您喜欢的颜色主题。您也可以在任意位置（文本输入框外）按{" "}
                            <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono font-medium text-muted-foreground">D</kbd>{" "}
                            快速切换明暗模式。
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-3">
                            {([
                                { value: "light", label: "浅色", Icon: Sun },
                                { value: "dark",  label: "深色",  Icon: Moon },
                                { value: "system", label: "跟随系统", Icon: Monitor },
                            ] as const).map(({ value, label, Icon }) => (
                                <button
                                    key={value}
                                    onClick={() => setTheme(value)}
                                    className={[
                                        "flex flex-col items-center gap-2 rounded-lg border-2 px-3 py-4 text-sm font-medium transition-colors",
                                        theme === value
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                                    ].join(" ")}
                                >
                                    <Icon className="size-5" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* ── Notification Settings card ─────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>通知</CardTitle>
                        <CardDescription>管理您的通知偏好设置</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium">横幅通知</p>
                                <p className="text-xs text-muted-foreground">在屏幕右上角显示消息通知</p>
                            </div>
                            <Switch
                                checked={bannersEnabled}
                                onCheckedChange={toggleBanners}
                            />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium">消息提示音</p>
                                <p className="text-xs text-muted-foreground">收到新消息时播放提示音</p>
                            </div>
                            <Switch
                                checked={soundEnabled}
                                onCheckedChange={toggleSound}
                            />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-sm font-medium">邮件通知</p>
                                <p className="text-xs text-muted-foreground">离线时通过邮件接收消息通知</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {emailNotifsLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                                <Switch
                                    checked={emailNotifsEnabled}
                                    onCheckedChange={toggleEmailNotifs}
                                    disabled={emailNotifsLoading}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Account Actions card ──────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>账户</CardTitle>
                        <CardDescription>管理您的会话和账户</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button
                            variant="outline"
                            className="w-full justify-center gap-2"
                            onClick={handleLogout}
                        >
                            退出登录
                        </Button>
                        <Button
                            variant="destructive"
                            className="w-full justify-center gap-2"
                            onClick={() => { setDeleteConfirmText(""); setDeleteDialogOpen(true) }}
                        >
                            删除我的账户
                        </Button>
                    </CardContent>
                </Card>

            </div>
        </div>

        {/* ── Delete Account confirmation dialog ─────────────────────── */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>删除账户？</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-3">
                            <p>
                                此操作<strong>无法撤销</strong>。您的个人资料将被匿名化 —
                                您的姓名、邮箱和简介将被清除，但您的消息和对话
                                对其他参与者仍然可见。
                            </p>
                            <p>输入 <strong>DELETE</strong> 以确认：</p>
                            <Input
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="DELETE"
                                className="font-mono"
                            />
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={deleteConfirmText !== "DELETE" || deleting}
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {deleting ? <><Loader2 className="size-4 mr-2 animate-spin" />删除中…</> : "删除账户"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}

export default UserProfile
