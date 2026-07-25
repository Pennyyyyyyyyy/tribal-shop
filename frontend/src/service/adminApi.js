// Admin API client — 統一處理 base URL、JWT header、401 過期。
// 對應 worker/src/handlers/adminApi.js 的路徑。
const BASE = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";
const TOKEN_KEY = "tribal_admin_token";

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${BASE}/api/admin${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
        clearToken();
        // 讓呼叫端 catch 到；上層 hook 會導回 /admin/login
        throw new ApiError(401, "尚未登入或憑證已過期");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new ApiError(res.status, data.error || `HTTP ${res.status}`);
    }
    return data;
}

// ─── Public / Auth ──────────────────────────────────────────────
export async function login(password) {
    const data = await request("/login", { method: "POST", body: { password }, auth: false });
    setToken(data.token);
    return data;
}

export function logout() {
    clearToken();
}

// ─── Products ───────────────────────────────────────────────────
export const products = {
    list: () => request("/products"),
    get: (id) => request(`/products/${id}`),
    create: (body) => request("/products", { method: "POST", body }),
    update: (id, body) => request(`/products/${id}`, { method: "PATCH", body }),
    remove: (id) => request(`/products/${id}`, { method: "DELETE" }),
};

// ─── Transactions ───────────────────────────────────────────────
export const transactions = {
    list: ({ from, to } = {}) => {
        const q = new URLSearchParams();
        if (from) q.set("from", from);
        if (to) q.set("to", to);
        const qs = q.toString();
        return request(`/transactions${qs ? `?${qs}` : ""}`);
    },
    assignDebtor: (id, memberId) =>
        request(`/transactions/${id}/assign-debtor`, {
            method: "POST",
            body: { member_id: memberId },
        }),
};

// ─── Members ────────────────────────────────────────────────────
export const members = {
    list: () => request("/members"),
    create: (body) => request("/members", { method: "POST", body }),
    update: (id, body) => request(`/members/${id}`, { method: "PATCH", body }),
    repay: (id, amount) => request(`/members/${id}/repay`, { method: "POST", body: { amount } }),
};

// ─── Announcements ──────────────────────────────────────────────
export const announcements = {
    list: () => request("/announcements"),
    create: (body) => request("/announcements", { method: "POST", body }),
    update: (id, body) => request(`/announcements/${id}`, { method: "PATCH", body }),
    remove: (id) => request(`/announcements/${id}`, { method: "DELETE" }),
};

// ─── Dashboard ──────────────────────────────────────────────────
export const stats = {
    dashboard: () => request("/stats/dashboard"),
};
