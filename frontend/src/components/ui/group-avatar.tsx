import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { User } from "@/hooks/use-auth"

interface GroupAvatarProps {
    members: User[]
    size?: number
}

function initials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
}

export function GroupAvatar({ members, size = 40 }: GroupAvatarProps) {
    if (!members || members.length === 0) {
        return (
            <div
                className="relative shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center"
                style={{ width: size, height: size }}
            >
                <span className="text-muted-foreground text-xs">?</span>
            </div>
        )
    }

    const maxDisplay = 9
    const displayMembers = members.slice(0, maxDisplay)
    const count = displayMembers.length

    const getGridConfig = (memberCount: number): { cols: number; rows: number } => {
        if (memberCount === 1) return { cols: 1, rows: 1 }
        if (memberCount === 2) return { cols: 2, rows: 1 }
        if (memberCount <= 4) return { cols: 2, rows: 2 }
        if (memberCount <= 6) return { cols: 3, rows: 2 }
        return { cols: 3, rows: 3 }
    }

    const grid = getGridConfig(count)
    const gap = 2
    const totalGapH = (grid.cols - 1) * gap
    const totalGapV = (grid.rows - 1) * gap
    const avatarSize = (size - totalGapH) / grid.cols

    return (
        <div
            className="relative shrink-0 rounded-lg overflow-hidden bg-muted"
            style={{
                width: size,
                height: size,
                display: 'grid',
                gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
                gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
                gap: gap,
                padding: 1,
            }}
        >
            {displayMembers.map((member) => (
                <div
                    key={member._id}
                    className="flex items-center justify-center overflow-hidden"
                >
                    <Avatar
                        style={{
                            width: avatarSize,
                            height: avatarSize,
                        }}
                        className="rounded-sm"
                    >
                        <AvatarImage src={member.profilePic} alt={member.name} />
                        <AvatarFallback 
                            className="bg-primary/15 font-semibold rounded-sm"
                            style={{ fontSize: Math.max(6, avatarSize * 0.35) }}
                        >
                            {initials(member.name || "U")}
                        </AvatarFallback>
                    </Avatar>
                </div>
            ))}
        </div>
    )
}
