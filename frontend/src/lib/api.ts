/**
 * Centralized API client.
 *
 * Every HTTP call in the app goes through this file.  If the base URL, auth
 * header, or error-handling logic ever needs to change, there is exactly one
 * place to update.
 */

const API_BASE: string =
    import.meta.env.VITE_API_URL ?? "http://localhost:5500";

/* ─── payload / response types ─────────────────────────────────────────── */

export interface LoginPayload {
    email: string;
    password?: string;
    otp?: string;
}

export interface AuthTokenResponse {
    authtoken: string;
    user?: {
        _id: string;
        name: string;
        email: string;
        profilePic: string;
        isEmailVerified: boolean;
    };
}

export interface RegisterPayload {
    name: string;
    email: string;
    password: string;
}

export interface UpdateProfilePayload {
    name?: string;
    about?: string;
    profilePic?: string;
    oldpassword?: string;
    newpassword?: string;
    emailNotificationsEnabled?: boolean;
}

export type NonFriendsSort = "name_asc" | "name_desc" | "last_seen_recent" | "last_seen_oldest";

export interface NonFriendsParams {
    search?: string;
    sort?: NonFriendsSort;
    page?: number;
    limit?: number;
}

/* ─── helpers ──────────────────────────────────────────────────────────── */

const getToken = (): string => localStorage.getItem("auth-token") ?? "";

const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    "Content-Type": "application/json",
    "auth-token": getToken(),
    ...extra,
});

const handleResponse = async <T = unknown>(res: Response): Promise<T> => {
    let data: T & { error?: string };
    try {
        const text = await res.text();
        if (!text) {
            if (!res.ok) throw new Error("请求失败，请稍后重试。");
            return {} as T;
        }
        data = JSON.parse(text) as T & { error?: string };
    } catch {
        if (!res.ok) {
            if (res.status === 500) throw new Error("服务器错误，请稍后重试。");
            if (res.status === 429) throw new Error("请求过于频繁，请稍后再试。");
            if (res.status === 401) throw new Error("登录已过期，请重新登录。");
            if (res.status === 403) throw new Error("没有权限执行此操作。");
            if (res.status === 404) throw new Error("请求的资源不存在。");
            throw new Error(`请求失败 (${res.status})，请稍后重试。`);
        }
        throw new Error("服务器响应格式错误，请稍后重试。");
    }
    if (!res.ok) throw new Error(data.error ?? "请求失败，请稍后重试。");
    return data;
};

/* ─── auth ─────────────────────────────────────────────────────────────── */

export const authApi = {
    login: (payload: LoginPayload) =>
        fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(payload),
        }).then((res) => handleResponse<AuthTokenResponse>(res)),

    register: (payload: RegisterPayload) =>
        fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(payload),
        }).then((res) => handleResponse<AuthTokenResponse>(res)),

    getMe: <T = unknown>() =>
        fetch(`${API_BASE}/auth/me`, {
            headers: headers(),
        }).then((res) => handleResponse<T>(res)),

    sendOtp: (email: string) =>
        fetch(`${API_BASE}/auth/getotp`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ email }),
        }).then(handleResponse),

    sendVerificationOtp: () =>
        fetch(`${API_BASE}/auth/send-verification-otp`, {
            method: "POST",
            headers: headers(),
        }).then(handleResponse),

    verifyEmail: (otp: string) =>
        fetch(`${API_BASE}/auth/verify-email`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ otp }),
        }).then(handleResponse),
};

/* ─── conversations ────────────────────────────────────────────────────── */

export const conversationApi = {
    list: <T = unknown>() =>
        fetch(`${API_BASE}/conversation/`, {
            headers: headers(),
        }).then((res) => handleResponse<T>(res)),

    get: <T = unknown>(id: string) =>
        fetch(`${API_BASE}/conversation/${id}`, {
            headers: headers(),
        }).then((res) => handleResponse<T>(res)),

    create: (memberIds: string[]) =>
        fetch(`${API_BASE}/conversation/`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ members: memberIds }),
        }).then(handleResponse),

    togglePin: (id: string) =>
        fetch(`${API_BASE}/conversation/${id}/pin`, {
            method: "POST",
            headers: headers(),
        }).then((res) => handleResponse<{ isPinned: boolean }>(res)),

    delete: (id: string) =>
        fetch(`${API_BASE}/conversation/${id}`, {
            method: "DELETE",
            headers: headers(),
        }).then(handleResponse),
};

/* ─── messages ─────────────────────────────────────────────────────────── */

export const messageApi = {
    list: (conversationId: string) =>
        fetch(`${API_BASE}/message/${conversationId}`, {
            headers: headers(),
        }).then(handleResponse),

    delete: (messageId: string, scope: "me" | "everyone") =>
        fetch(`${API_BASE}/message/${messageId}`, {
            method: "DELETE",
            headers: headers(),
            body: JSON.stringify({ scope }),
        }).then(handleResponse),

    bulkDelete: (messageIds: string[]) =>
        fetch(`${API_BASE}/message/bulk/hide`, {
            method: "DELETE",
            headers: headers(),
            body: JSON.stringify({ messageIds }),
        }).then(handleResponse),

    clearChat: (conversationId: string) =>
        fetch(`${API_BASE}/message/clear/${conversationId}`, {
            method: "POST",
            headers: headers(),
        }).then(handleResponse),

    toggleStar: (messageId: string) =>
        fetch(`${API_BASE}/message/${messageId}/star`, {
            method: "POST",
            headers: headers(),
        }).then((res) => handleResponse<{ isStarred: boolean; starredBy: string[] }>(res)),

    getStarred: <T = unknown>() =>
        fetch(`${API_BASE}/message/starred`, {
            headers: headers(),
        }).then((res) => handleResponse<T>(res)),

    translate: (text: string) =>
        fetch(`${API_BASE}/message/translate`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ text }),
        }).then((res) => handleResponse<{ translatedText: string }>(res)),
};

/* ─── users ────────────────────────────────────────────────────────────── */

export const userApi = {
    getOnlineStatus: (userId: string) =>
        fetch(`${API_BASE}/user/online-status/${userId}`, {
            headers: headers(),
        }).then(handleResponse),

    getNonFriends: (params: NonFriendsParams = {}) => {
        const qs = new URLSearchParams()
        if (params.search) qs.set("search", params.search)
        if (params.sort)   qs.set("sort",   params.sort)
        if (params.page)   qs.set("page",   String(params.page))
        if (params.limit)  qs.set("limit",  String(params.limit))
        return fetch(`${API_BASE}/user/non-friends?${qs.toString()}`, {
            headers: headers(),
        }).then(handleResponse)
    },

    updateProfile: (payload: UpdateProfilePayload) =>
        fetch(`${API_BASE}/user/update`, {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify(payload),
        }).then(handleResponse),

    uploadAvatar: (file: File) => {
        const formData = new FormData()
        formData.append("avatar", file)
        return fetch(`${API_BASE}/user/avatar`, {
            method: "POST",
            headers: { "auth-token": localStorage.getItem("auth-token") || "" },
            body: formData,
        }).then(handleResponse)
    },

    blockUser: (userId: string) =>
        fetch(`${API_BASE}/user/block/${userId}`, {
            method: "POST",
            headers: headers(),
        }).then(handleResponse),

    unblockUser: (userId: string) =>
        fetch(`${API_BASE}/user/block/${userId}`, {
            method: "DELETE",
            headers: headers(),
        }).then(handleResponse),

    getBlockStatus: (userId: string) =>
        fetch(`${API_BASE}/user/block-status/${userId}`, {
            headers: headers(),
        }).then((res) => handleResponse<{ iBlockedThem: boolean; theyBlockedMe: boolean }>(res)),

    deleteAccount: () =>
        fetch(`${API_BASE}/user/delete`, {
            method: "DELETE",
            headers: headers(),
        }).then(handleResponse),
};

export interface CreateGroupPayload {
    name: string;
    memberIds: string[];
    description?: string;
}

export interface UpdateGroupPayload {
    name?: string;
    description?: string;
    avatar?: string;
}

export const groupApi = {
    create: (payload: CreateGroupPayload) =>
        fetch(`${API_BASE}/group/create`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(payload),
        }).then(handleResponse),

    get: <T = unknown>(groupId: string) =>
        fetch(`${API_BASE}/group/${groupId}`, {
            headers: headers(),
        }).then((res) => handleResponse<T>(res)),

    update: (groupId: string, payload: UpdateGroupPayload) =>
        fetch(`${API_BASE}/group/${groupId}`, {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify(payload),
        }).then(handleResponse),

    addMembers: (groupId: string, memberIds: string[]) =>
        fetch(`${API_BASE}/group/${groupId}/members`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ memberIds }),
        }).then(handleResponse),

    removeMember: (groupId: string, memberId: string) =>
        fetch(`${API_BASE}/group/${groupId}/members/${memberId}`, {
            method: "DELETE",
            headers: headers(),
        }).then(handleResponse),

    leave: (groupId: string) =>
        fetch(`${API_BASE}/group/${groupId}/leave`, {
            method: "POST",
            headers: headers(),
        }).then(handleResponse),

    setAdmin: (groupId: string, memberId: string, isAdmin: boolean) =>
        fetch(`${API_BASE}/group/${groupId}/admin/${memberId}`, {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify({ isAdmin }),
        }).then(handleResponse),

    transferOwnership: (groupId: string, newOwnerId: string) =>
        fetch(`${API_BASE}/group/${groupId}/transfer/${newOwnerId}`, {
            method: "PUT",
            headers: headers(),
        }).then(handleResponse),

    summarizeUnread: (groupId: string) =>
        fetch(`${API_BASE}/group/${groupId}/summarize-unread`, {
            method: "POST",
            headers: headers(),
        }).then((res) => handleResponse<{ summary: string; unreadCount: number; hasUnread: boolean }>(res)),
};

export interface LeetCodeProblem {
    _id: string;
    problemId: number;
    title: string;
    titleSlug: string;
    difficulty: "Easy" | "Medium" | "Hard";
    tags: string[];
    order: number;
    solved: boolean;
}

export interface LeetCodeProgress {
    total: number;
    solved: number;
    percentage: number;
    byDifficulty: {
        easy: { total: number; solved: number };
        medium: { total: number; solved: number };
        hard: { total: number; solved: number };
    };
}

export interface LeaderboardEntry {
    _id: string;
    name: string;
    profilePic: string;
    solved: number;
    isCurrentUser: boolean;
}

export const leetcodeApi = {
    init: () =>
        fetch(`${API_BASE}/leetcode/init`, {
            method: "POST",
            headers: headers(),
        }).then(handleResponse),

    getProblems: () =>
        fetch(`${API_BASE}/leetcode/problems`, {
            headers: headers(),
        }).then((res) => handleResponse<LeetCodeProblem[]>(res)),

    toggleSolved: (problemId: number) =>
        fetch(`${API_BASE}/leetcode/problems/${problemId}/toggle`, {
            method: "POST",
            headers: headers(),
        }).then((res) => handleResponse<{ solved: boolean }>(res)),

    getProgress: () =>
        fetch(`${API_BASE}/leetcode/progress`, {
            headers: headers(),
        }).then((res) => handleResponse<LeetCodeProgress>(res)),

    getLeaderboard: () =>
        fetch(`${API_BASE}/leetcode/leaderboard`, {
            headers: headers(),
        }).then((res) => handleResponse<LeaderboardEntry[]>(res)),
};

export { API_BASE };
