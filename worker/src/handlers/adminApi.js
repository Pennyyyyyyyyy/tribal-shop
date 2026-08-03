// /api/admin/* — 後台管理 REST API。
// 認證：POST /login 拿 JWT → 之後所有請求帶 Authorization: Bearer <token>。
// 所有商業邏輯都走 services/，不在這裡實作 SQL 或 LINE 呼叫。
import * as auth from "../lib/auth.js";
import * as products from "../services/products.js";
import * as members from "../services/members.js";
import * as transactions from "../services/transactions.js";
import * as announcements from "../services/announcements.js";
import * as stats from "../services/stats.js";
import * as consignors from "../services/consignors.js";
import * as payouts from "../services/payouts.js";
import * as notifications from "../services/notifications.js";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export async function handleAdminApi(request, env, url) {
    // path 相對 /api/admin 之後：例如 /products/3 → "/products/3"
    const path = url.pathname.replace(/^\/api\/admin/, "") || "/";
    const method = request.method;

    try {
        // 公開：POST /api/admin/login
        if (method === "POST" && path === "/login") {
            return await handleLogin(request, env);
        }

        // 其餘一律要 JWT
        const authErr = await requireAuth(request, env);
        if (authErr) return authErr;

        return await route(method, path, request, env, url);
    } catch (err) {
        return json({ error: err.message || "internal error" }, 500);
    }
}

// ─── Login ───────────────────────────────────────────────────────
async function handleLogin(request, env) {
    if (!env.ADMIN_PASSWORD || !env.JWT_SECRET) {
        return json({ error: "admin API not configured (missing ADMIN_PASSWORD or JWT_SECRET)" }, 500);
    }
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON body" }, 400);
    }
    const { password } = body || {};
    if (!password || !auth.timingSafeEqual(password, env.ADMIN_PASSWORD)) {
        return json({ error: "invalid password" }, 401);
    }
    const token = await auth.signJwt({ sub: "admin" }, env.JWT_SECRET);
    return json({ token, expires_in: 60 * 60 * 24 });
}

// ─── JWT middleware ──────────────────────────────────────────────
async function requireAuth(request, env) {
    if (!env.JWT_SECRET) return json({ error: "JWT_SECRET not configured" }, 500);
    const header = request.headers.get("Authorization") || "";
    if (!header.startsWith("Bearer ")) return json({ error: "missing bearer token" }, 401);
    const payload = await auth.verifyJwt(header.slice(7), env.JWT_SECRET);
    if (!payload) return json({ error: "invalid or expired token" }, 401);
    return null; // ok
}

// ─── Router ──────────────────────────────────────────────────────
async function route(method, path, request, env, url) {
    // Products
    if (path === "/products") {
        if (method === "GET") return json(await products.listAll(env));
        if (method === "POST") {
            const body = await request.json();
            return json(await products.create(env, body), 201);
        }
    }
    const productMatch = path.match(/^\/products\/(\d+)$/);
    if (productMatch) {
        const id = productMatch[1];
        if (method === "GET") return json(await products.getById(env, id));
        if (method === "PATCH") {
            const body = await request.json();
            return json(await products.update(env, id, body));
        }
        if (method === "DELETE") {
            await products.remove(env, id);
            return json({ status: "deleted", id: parseInt(id) });
        }
    }

    // Transactions
    if (path === "/transactions" && method === "GET") {
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        return json(await transactions.list(env, { from, to }));
    }
    // 指認族人 — 補上 LINE 沒接到 quick reply 的情況（identity 還是「待確認族人」的 tx）
    // 效果等同 LINE postback 的 confirm_debtor：寫 credit 表 + 累加 member.total_debt + 改 tx.identity
    const assignMatch = path.match(/^\/transactions\/(\d+)\/assign-debtor$/);
    if (assignMatch && method === "POST") {
        const body = await request.json();
        const memberId = parseInt(body.member_id);
        if (!memberId) return json({ error: "member_id required" }, 400);
        const tx = await transactions.getById(env, assignMatch[1]);
        if (!tx) return json({ error: "transaction not found" }, 404);
        const member = await members.addDebtForTransaction(env, {
            memberId,
            txId: tx.id,
            amount: tx.total,
        });
        if (!member) return json({ error: "member not found" }, 404);
        await transactions.setIdentity(env, tx.id, member.nickname);
        return json({
            ok: true,
            transaction_id: tx.id,
            member: member.nickname,
            amount: tx.total,
        });
    }

    // Members
    if (path === "/members") {
        if (method === "GET") return json(await members.list(env));
        if (method === "POST") {
            const body = await request.json();
            const nickname = (body.nickname || "").trim();
            if (!nickname) return json({ error: "nickname required" }, 400);
            return json(await members.create(env, { nickname }), 201);
        }
    }
    const memberIdMatch = path.match(/^\/members\/(\d+)$/);
    if (memberIdMatch && method === "PATCH") {
        const body = await request.json();
        const nickname = (body.nickname || "").trim();
        if (!nickname) return json({ error: "nickname required" }, 400);
        await members.updateNickname(env, memberIdMatch[1], nickname);
        return json({ ok: true, id: parseInt(memberIdMatch[1]), nickname });
    }
    const repayMatch = path.match(/^\/members\/(\d+)\/repay$/);
    if (repayMatch && method === "POST") {
        const body = await request.json();
        const amount = parseInt(body.amount);
        if (isNaN(amount) || amount <= 0) return json({ error: "amount must be positive integer" }, 400);
        const newTotalDebt = await members.repay(env, repayMatch[1], amount);
        if (newTotalDebt === null) return json({ error: "member not found" }, 404);
        return json({ member_id: parseInt(repayMatch[1]), total_debt: newTotalDebt });
    }

    // Announcements
    if (path === "/announcements") {
        if (method === "GET") return json(await announcements.list(env));
        if (method === "POST") {
            const body = await request.json();
            if (!body.description) return json({ error: "description required" }, 400);
            await announcements.create(env, body);
            return json({ status: "created" }, 201);
        }
    }
    const annMatch = path.match(/^\/announcements\/(\d+)$/);
    if (annMatch) {
        const id = annMatch[1];
        if (method === "PATCH") {
            const body = await request.json();
            if (body.title === undefined && body.description === undefined) {
                return json({ error: "nothing to update" }, 400);
            }
            await announcements.update(env, id, body);
            return json({ ok: true, id: parseInt(id) });
        }
        if (method === "DELETE") {
            await announcements.remove(env, id);
            return json({ status: "deleted", id: parseInt(id) });
        }
    }

    // Dashboard
    if (path === "/stats/dashboard" && method === "GET") {
        return json(await stats.dashboard(env));
    }

    // ─── Consignors 寄賣族人 ────────────────────────────────────────
    if (path === "/consignors" && method === "GET") {
        return json(await consignors.list(env));
    }
    // /consignors/<lineId>?from=&to= — lineId 是 text，前端要 encodeURIComponent；[^/]+ 匹配到下一個 slash。
    const consignorMatch = path.match(/^\/consignors\/([^\/]+)$/);
    if (consignorMatch && method === "GET") {
        const lineId = decodeURIComponent(consignorMatch[1]);
        const consignor = await consignors.getByLineId(env, lineId);
        if (!consignor) return json({ error: "consignor not found" }, 404);
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const sales = (from && to) ? await consignors.getSalesInRange(env, lineId, from, to) : [];
        return json({ consignor, from, to, sales });
    }

    // ─── Payouts 分潤結算 ───────────────────────────────────────────
    // Preview：試算不寫入。放在 /payouts/preview 而不用 GET，避免 query string 太長且語意上是「計算」。
    if (path === "/payouts/preview" && method === "POST") {
        const body = await request.json();
        const { consignor_line_id, from, to } = body || {};
        if (!consignor_line_id || !from || !to) return json({ error: "consignor_line_id, from, to required" }, 400);
        return json(await payouts.computePeriod(env, { lineId: consignor_line_id, from, to }));
    }

    if (path === "/payouts") {
        if (method === "GET") {
            const lineId = url.searchParams.get("consignor");
            const status = url.searchParams.get("status");
            return json(await payouts.list(env, { lineId, status }));
        }
        if (method === "POST") {
            const body = await request.json();
            const { consignor_line_id, from, to } = body || {};
            if (!consignor_line_id || !from || !to) return json({ error: "consignor_line_id, from, to required" }, 400);
            try {
                return json(await payouts.create(env, { lineId: consignor_line_id, from, to }), 201);
            } catch (err) {
                // 覆蓋期間衝突走 409（客戶端要提示改日期），其他錯誤走 500 由外層 try catch 處理。
                if (err.message && err.message.includes("重疊")) return json({ error: err.message }, 409);
                throw err;
            }
        }
    }

    const payoutIdMatch = path.match(/^\/payouts\/(\d+)$/);
    if (payoutIdMatch) {
        const id = payoutIdMatch[1];
        if (method === "GET") return json(await payouts.getById(env, id));
        if (method === "DELETE") {
            const force = url.searchParams.get("force") === "true";
            try {
                await payouts.remove(env, id, { force });
                return json({ status: "deleted", id: parseInt(id) });
            } catch (err) {
                return json({ error: err.message }, 400);
            }
        }
    }

    // 改回待付（撤銷）。不發 LINE 通知。
    const unmarkPaidMatch = path.match(/^\/payouts\/(\d+)\/unmark-paid$/);
    if (unmarkPaidMatch && method === "POST") {
        const id = unmarkPaidMatch[1];
        const payout = await payouts.unmarkPaid(env, id);
        if (!payout) return json({ error: "payout not found" }, 404);
        return json({ ok: true, payout });
    }

    // 標記已付 + 通知族人。通知寫在 handler 而非 service，讓「通知失敗不影響已付狀態」自然發生。
    const markPaidMatch = path.match(/^\/payouts\/(\d+)\/mark-paid$/);
    if (markPaidMatch && method === "POST") {
        const id = markPaidMatch[1];
        const payout = await payouts.markPaid(env, id);
        if (!payout) return json({ error: "payout not found" }, 404);
        let notified = true;
        try {
            const summary = await payouts.computePeriod(env, {
                lineId: payout.consignor_line_id,
                from: payout.period_start,
                to: payout.period_end,
            });
            await notifications.notifyConsignorPayout(env, {
                lineId: payout.consignor_line_id,
                summary,
            });
        } catch {
            notified = false;
        }
        return json({ ok: true, payout, notified });
    }

    return json({ error: "not found", path, method }, 404);
}
