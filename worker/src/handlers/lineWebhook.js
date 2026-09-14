// POST /callback — LINE Messaging API 的 webhook 入口。
// 收到後依 event.type 分四種分支：
//   follow      → 新好友 → autoRegister（依 channel 決定 role）+ 歡迎詞 + 問暱稱
//   postback    → 按鈕點擊
//   text 訊息   → 多步驟狀態機 + role-routed 指令
//   image 訊息  → 上架流程照片（用 user.temp_data.pendingProductId 綁定 product）
//
// 雙 channel 架構（架構 X）：進入時用 body.destination 決定 channel（'manager' | 'consignor'），
// 所有下游 line.* 呼叫都要帶 channel，避免 token 錯配。認不出的 destination 靜默忽略。
//
// 對話狀態存在 users.last_command + users.temp_data，每個 handler 完事要 resetState。
// 全域規則：webhook 出錯一律回 200 OK，避免 LINE 平台反覆重送。
import * as users from "../services/users.js";
import * as products from "../services/products.js";
import * as members from "../services/members.js";
import * as transactions from "../services/transactions.js";
import * as announcements from "../services/announcements.js";
import * as training from "../services/training.js";
import * as notifications from "../services/notifications.js";
import * as consignors from "../services/consignors.js";
import * as payouts from "../services/payouts.js";
import * as supabase from "../lib/supabase.js";
import * as line from "../lib/line.js";

const PRODUCT_CATEGORIES = ["零食", "玩具", "日用品", "特色商品", "調味料", "泡麵"];

const APPROVAL_LABEL = {
    pending: "待審核",
    approved: "已上架",
    rejected: "已駁回",
};

// LINE bot 標準架構：webhook 進來立即回 200 OK，實際處理用 ctx.waitUntil 背景執行。
// 這樣 LINE 那端秒收 200、不會 timeout；同時 Cloudflare 也不會因客戶端斷線
// 而中止我們的 async work（照片下載 + Supabase 上傳 + LINE reply 是一連串 fetch，
// 每個都要 500ms~2s，加起來很容易踩到 LINE webhook 的容忍時間）。
export async function handleLineWebhook(request, env, ctx) {
    let body;
    try {
        body = await request.json();
    } catch (err) {
        console.error(`[webhook] JSON parse error:`, err?.message);
        return new Response("OK");
    }
    if (!body.events || body.events.length === 0) return new Response("OK");

    // 背景處理；即使 LINE 那端斷線，這些 subrequest 也會跑完
    ctx.waitUntil(processEvent(env, body).catch(err => {
        console.error(`[webhook] processEvent 未捕獲例外:`, err?.stack || err?.message || err);
    }));
    return new Response("OK");
}

async function processEvent(env, body) {
    // 依 body.destination 判斷是哪支 bot 收到。認不出 → 靜默忽略。
    const destination = body.destination;
    const channel = destination === env.LINE_CONSIGNOR_BOT_ID ? "consignor"
                  : destination === env.LINE_MANAGER_BOT_ID ? "manager"
                  : null;
    console.log(`[webhook] destination=${destination} channel=${channel} events=${body.events.length}`);
    if (!channel) {
        console.warn(`[webhook] 未知 destination（不是 manager 也不是 consignor bot），忽略。env.LINE_MANAGER_BOT_ID=${env.LINE_MANAGER_BOT_ID} env.LINE_CONSIGNOR_BOT_ID=${env.LINE_CONSIGNOR_BOT_ID}`);
        return;
    }

    const event = body.events[0];
    const userId = event.source.userId;

    // 新使用者 → role 依 channel 決定；老使用者 role 保持不變。
    const defaultRole = channel === "consignor" ? "consignor" : "manager";
    const existingUser = await users.getByLineId(env, userId);
    const user = existingUser || (await users.autoRegister(env, userId, defaultRole));
    console.log(`[webhook] userId=${userId} role=${user.role} last_command=${user.last_command} event.type=${event.type}${existingUser ? "" : " (新註冊)"}`);

    if (event.type === "follow") {
        await handleFollow(env, event, userId, channel);
        return;
    }
    if (event.type === "postback") {
        console.log(`[webhook] postback data=${event.postback.data}`);
        await handlePostback(env, event, user, userId, channel);
        return;
    }
    if (event.type === "message" && event.message.type === "text") {
        console.log(`[webhook] text="${event.message.text}"`);
        await handleText(env, event, user, userId, user.last_command, channel);
        return;
    }
    if (event.type === "message" && event.message.type === "image") {
        console.log(`[webhook] image messageId=${event.message.id}`);
        await handleImage(env, event, user, userId, channel);
        return;
    }
}

// ─── Follow：新好友歡迎（僅 consignor bot）──────────────────────────
async function handleFollow(env, event, userId, channel) {
    if (channel === "consignor") {
        await users.setState(env, userId, "WAITING_NICKNAME");
        // notifyWelcome 內含歡迎介紹 + 「我可以怎麼稱呼你呢？」引導
        await notifications.notifyWelcome(env, userId);
    }
    // manager channel 加好友 → 不主動打招呼，避免打擾自己
    return new Response("OK");
}

// ─── Postback（按鈕點擊） ────────────────────────────────────────
async function handlePostback(env, event, user, userId, channel) {
    const data = event.postback.data;
    const params = new URLSearchParams(data);
    const action = params.get("action");

    // ── 通用（不分身份，但目前實際上都是 manager 才會收到）──
    if (action === "confirm_debtor") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        const txId = params.get("tx_id");
        const name = params.get("name");
        const tx = await transactions.getById(env, txId);
        const member = await members.getByNickname(env, name);
        if (tx && member) {
            await members.addDebtForTransaction(env, { memberId: member.id, txId, amount: tx.total });
            await transactions.setIdentity(env, txId, name);
            return await line.replyText(env, channel, event.replyToken, `✅ 帳務更新成功！\n族人：${name}\n金額：$${tx.total}`);
        }
        return new Response("OK");
    }

    // ── Manager 專用 ────────────────────────────────────────────
    if (data === "action=inventory") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        const list = await products.list(env);
        return await notifications.sendPicker(env, event.replyToken, "📦 選擇補貨商品", list, "select_stock_item");
    }

    if (action === "select_stock_item") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        await users.setState(env, userId, "WAITING_STOCK_QTY", {
            id: params.get("id"),
            name: params.get("name"),
        });
        return await line.replyText(env, channel, event.replyToken, `📝 已選：${params.get("name")}\n請輸入要「增加」的庫存數量：`);
    }

    if (data === "action=debt_menu") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        const list = await members.list(env);
        return await notifications.sendPicker(env, event.replyToken, "💸 選擇除帳族人", list, "select_member_repay");
    }

    if (action === "select_member_repay") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        await users.setState(env, userId, "WAITING_DEBT_INFO", {
            id: params.get("id"),
            name: params.get("name"),
        });
        return await line.replyText(env, channel, event.replyToken, `💸 已選：${params.get("name")}\n請輸入族人「還款」的金額：`);
    }

    if (data === "action=new_product_menu") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        await users.setState(env, userId, "WAITING_PRODUCT_INFO");
        return await line.replyText(
            env,
            channel,
            event.replyToken,
            "📝 請輸入新商品資訊：\n[名稱] [價格] [分類] [庫存]\n\n分類：零食、玩具、日用品、特色商品、調味料、泡麵",
        );
    }

    if (data === "action=bulletin" || data === "bulletin") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        await users.setState(env, userId, "WAITING_BULLETIN");
        return await line.replyText(env, channel, event.replyToken, "📢 請直接輸入布告欄公告內容：");
    }

    // 商品審核 —— 只 manager 能按
    if (action === "approve_product") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        const productId = params.get("product_id");
        const product = await products.getById(env, productId);
        if (!product) return await line.replyText(env, channel, event.replyToken, "❌ 找不到商品。");
        if (product.approval_status !== "pending") {
            return await line.replyText(env, channel, event.replyToken, `此商品已被處理（目前狀態：${APPROVAL_LABEL[product.approval_status] || product.approval_status}）。`);
        }
        await products.approve(env, productId);
        if (product.consignor_line_id) {
            await notifications.notifyConsignorApproval(env, product.consignor_line_id, product.name);
        }
        return await line.replyText(env, channel, event.replyToken, `✅ 已同意上架：${product.name}`);
    }

    if (action === "reject_product") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        const productId = params.get("product_id");
        const product = await products.getById(env, productId);
        if (!product) return await line.replyText(env, channel, event.replyToken, "❌ 找不到商品。");
        if (product.approval_status !== "pending") {
            return await line.replyText(env, channel, event.replyToken, `此商品已被處理（目前狀態：${APPROVAL_LABEL[product.approval_status] || product.approval_status}）。`);
        }
        await users.setState(env, userId, "WAITING_REJECT_REASON", { productId });
        return await line.replyText(env, channel, event.replyToken, "📝 請輸入駁回原因（會通知寄賣者、寫入 DB）：");
    }

    // ── Consignor 專用 ──────────────────────────────────────────
    if (action === "consignor_upload_start") {
        if (!isConsignor(user)) return await replyConsignorOnly(env, channel, event);
        await users.setState(env, userId, "WAITING_CONSIGNOR_PRODUCT_INFO");
        return await line.replyText(
            env,
            channel,
            event.replyToken,
            "📝 請輸入商品資訊（用空格分隔）：\n[名稱] [價格] [分類] [初始庫存]\n\n分類：零食、玩具、日用品、特色商品、調味料、泡麵\n例：手工餅乾 50 零食 20",
        );
    }

    // 銷售情況 — 本月至今、依商品聚合
    if (action === "consignor_view_sales") {
        if (!isConsignor(user)) return await replyConsignorOnly(env, channel, event);
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }); // YYYY-MM-DD
        const monthStart = today.slice(0, 7) + "-01";
        const sales = await consignors.getSalesInRange(env, userId, monthStart, today);
        if (sales.length === 0) {
            return await line.replyText(env, channel, event.replyToken, `📊 你的本月銷售 (${monthStart}~${today})\n\n本月尚無銷售。`);
        }
        // 依商品聚合
        const byProduct = new Map();
        for (const s of sales) {
            const key = s.product_id;
            const prev = byProduct.get(key) || { name: s.product_name, qty: 0, subtotal: 0 };
            prev.qty += s.quantity;
            prev.subtotal += s.subtotal;
            byProduct.set(key, prev);
        }
        const rows = [...byProduct.values()].sort((a, b) => b.subtotal - a.subtotal);
        const total = rows.reduce((s, x) => s + x.subtotal, 0);
        const lines = rows.map(x => `${x.name} × ${x.qty} = $${x.subtotal.toLocaleString()}`);
        const text = `📊 你的本月銷售 (${monthStart.slice(5)}~${today.slice(5)})\n\n總銷售：$${total.toLocaleString()}\n\n${lines.join("\n")}`;
        return await line.replyText(env, channel, event.replyToken, text);
    }

    // 分潤紀錄 — 最近 6 筆結算，簡潔行式
    if (action === "consignor_view_payouts") {
        if (!isConsignor(user)) return await replyConsignorOnly(env, channel, event);
        const list = await payouts.list(env, { lineId: userId });
        const recent = (Array.isArray(list) ? list : []).slice(0, 6);
        if (recent.length === 0) {
            return await line.replyText(env, channel, event.replyToken, "💰 你的分潤紀錄\n\n目前尚無結算紀錄（店長月底會統一結算）。");
        }
        const lines = recent.map(pt => {
            const emoji = pt.status === "paid" ? "✅" : "⏳";
            const range = `${trimDate(pt.period_start)}~${trimDate(pt.period_end)}`;
            const statusText = pt.status === "paid"
                ? `已付 ${trimDate((pt.paid_at || "").slice(0, 10))}`
                : "待付款";
            return `${emoji} ${range} · 應收 $${(pt.net_payout || 0).toLocaleString()} · ${statusText}`;
        });
        return await line.replyText(env, channel, event.replyToken, `💰 你的分潤紀錄\n\n${lines.join("\n")}`);
    }

    if (action === "consignor_list_own") {
        if (!isConsignor(user)) return await replyConsignorOnly(env, channel, event);
        const rows = await supabase.query(
            env,
            `/rest/v1/products?consignor_line_id=eq.${encodeURIComponent(userId)}&select=id,name,stock,approval_status,rejected_reason&order=id.desc`,
        );
        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) {
            return await line.replyText(env, channel, event.replyToken, "你還沒上架任何商品。");
        }
        const lines = list.map((p, i) => {
            const label = APPROVAL_LABEL[p.approval_status] || p.approval_status;
            let extra = "";
            if (p.approval_status === "approved") extra = ` · 庫存 ${p.stock}`;
            else if (p.approval_status === "rejected" && p.rejected_reason) extra = `：${p.rejected_reason}`;
            return `${i + 1}. ${p.name}（${label}${extra}）`;
        });
        return await line.replyText(env, channel, event.replyToken, `📋 你的商品：\n${lines.join("\n")}`);
    }

    return new Response("OK");
}

// ─── 文字訊息（含多步驟狀態） ────────────────────────────────────
async function handleText(env, event, user, userId, currentState, channel) {
    const userMsg = event.message.text.trim();
    const p = userMsg.split(/\s+/);

    // ── 通用指令（不吃 state）──
    if (userMsg === "/取消" || userMsg === "取消") {
        await users.resetState(env, userId);
        return await line.replyText(env, channel, event.replyToken, "✅ 已取消目前動作。");
    }

    if (userMsg === "/改暱稱") {
        await users.setState(env, userId, "WAITING_NICKNAME");
        return await line.replyText(env, channel, event.replyToken, "好的，請輸入新暱稱：");
    }

    // ── 狀態機 ───────────────────────────────────────────────
    if (currentState === "WAITING_NICKNAME") {
        if (!userMsg) {
            return await line.replyText(env, channel, event.replyToken, "請輸入非空白暱稱：");
        }
        await users.updateNickname(env, userId, userMsg);
        await users.resetState(env, userId);
        // 依身份給不同的引導選單。
        if (isManager(user)) {
            return await line.replyText(env, channel, event.replyToken, `太好了，${userMsg}！暱稱已更新。`);
        }
        return await notifications.sendConsignorMenu(
            env,
            event.replyToken,
            `太好了，${userMsg}！以下是你可以做的事：`,
        );
    }

    if (currentState === "WAITING_BULLETIN") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        await announcements.create(env, { description: userMsg });
        await users.resetState(env, userId);
        return await line.replyText(env, channel, event.replyToken, "✅ 公告發布成功！現場平板已同步更新。");
    }

    if (currentState === "WAITING_PRODUCT_INFO") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        if (p.length < 4 || !PRODUCT_CATEGORIES.includes(p[2])) {
            return await line.replyText(env, channel, event.replyToken, "❌ 格式錯誤。請輸入：[名稱] [價格] [分類] [庫存]");
        }
        const product = await products.create(env, { name: p[0], price: p[1], category: p[2], stock: p[3] });
        // 進入照片收集狀態（統一走 WAITING_PRODUCT_PHOTOS，讓 handleImage 用 temp_data 對應）。
        await users.setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId: product.id, photoCount: 0 });
        return await line.replyText(env, channel, event.replyToken, `✅【${p[0]}】建立成功！\n\n請先上傳商品的「正面照」1 張 📸`);
    }

    if (currentState === "WAITING_CONSIGNOR_PRODUCT_INFO") {
        console.log(`[consignor-upload] parse tokens: ${JSON.stringify(p)}`);
        if (!isConsignor(user)) {
            console.warn(`[consignor-upload] role gate 擋掉，user.role=${user.role}`);
            return await replyConsignorOnly(env, channel, event);
        }
        if (p.length < 4 || !PRODUCT_CATEGORIES.includes(p[2])) {
            console.warn(`[consignor-upload] 格式錯誤：token 數=${p.length}, category=${p[2]}, valid=${PRODUCT_CATEGORIES.includes(p[2])}`);
            return await line.replyText(env, channel, event.replyToken, "❌ 格式錯誤。請輸入：[名稱] [價格] [分類] [初始庫存]\n分類：零食、玩具、日用品、特色商品、調味料、泡麵");
        }
        console.log(`[consignor-upload] 準備 createPending: name=${p[0]} price=${p[1]} category=${p[2]} stock=${p[3]}`);
        let product;
        try {
            product = await products.createPending(env, {
                name: p[0],
                price: p[1],
                category: p[2],
                stock: p[3],
                consignorLineId: userId,
            });
            console.log(`[consignor-upload] createPending 回傳:`, JSON.stringify(product));
        } catch (err) {
            console.error(`[consignor-upload] createPending throw:`, err?.stack || err?.message || err);
            return await line.replyText(env, channel, event.replyToken, `❌ 建立商品失敗：${err?.message || "unknown"}`);
        }
        if (!product || !product.id) {
            console.error(`[consignor-upload] createPending 回傳無效 product:`, product);
            return await line.replyText(env, channel, event.replyToken, "❌ 建立商品失敗（DB 沒回 id）");
        }
        await users.setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId: product.id, photoCount: 0 });
        console.log(`[consignor-upload] setState WAITING_PRODUCT_PHOTOS, productId=${product.id}`);
        const resp = await line.replyText(
            env,
            channel,
            event.replyToken,
            `✅ 商品「${p[0]}」建立成功！\n\n請先上傳商品的「正面照」1 張 📸`,
        );
        console.log(`[consignor-upload] replyText status=${resp.status}`);
        return resp;
    }

    if (currentState === "WAITING_STOCK_QTY") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        const qty = parseInt(userMsg);
        if (isNaN(qty)) return await line.replyText(env, channel, event.replyToken, "❌ 請輸入數字。");
        const { id, name } = user.temp_data;
        const newStock = await products.adjustStock(env, id, qty);
        await products.recordRestock(env, id, qty);
        await users.resetState(env, userId);
        return await line.replyText(env, channel, event.replyToken, `📦 ${name} 更新成功！目前：${newStock}`);
    }

    if (currentState === "WAITING_DEBT_INFO") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        const qty = parseInt(userMsg);
        if (isNaN(qty) || qty <= 0) return await line.replyText(env, channel, event.replyToken, "❌ 請輸入正確金額。");
        const { id, name } = user.temp_data;
        const newTotalDebt = await members.repay(env, id, qty);
        await users.resetState(env, userId);
        return await line.replyText(env, channel, event.replyToken, `💸【除帳成功】\n族人：${name}\n目前總欠款：$${newTotalDebt}`);
    }

    if (currentState === "WAITING_REJECT_REASON") {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        const { productId } = user.temp_data || {};
        if (!productId) {
            await users.resetState(env, userId);
            return await line.replyText(env, channel, event.replyToken, "找不到要駁回的商品，動作取消。");
        }
        const product = await products.getById(env, productId);
        if (!product) {
            await users.resetState(env, userId);
            return await line.replyText(env, channel, event.replyToken, "商品已消失，動作取消。");
        }
        // 先通知寄賣者；通知失敗就不 update DB（保留 pending 給店長重試）。
        if (product.consignor_line_id) {
            try {
                await notifications.notifyConsignorRejection(env, product.consignor_line_id, product.name, userMsg);
            } catch (err) {
                await users.resetState(env, userId);
                return await line.replyText(env, channel, event.replyToken, `❌ LINE 通知失敗，未駁回：${err.message}`);
            }
        }
        await products.reject(env, productId, userMsg);
        await users.resetState(env, userId);
        return await line.replyText(env, channel, event.replyToken, `❌ 已駁回：${product.name}\n原因：${userMsg}`);
    }

    // ── 非狀態指令 ───────────────────────────────────────────
    if (userMsg.startsWith("查詢")) {
        if (!isManager(user)) return await replyManagerOnly(env, channel, event);
        const m = await members.getByNickname(env, p[1]);
        if (m) return await line.replyText(env, channel, event.replyToken, `👤 ${p[1]} 欠款：$${m.total_debt}`);
    }

    return new Response("OK");
}

// ─── 圖片訊息（訓練照片） ────────────────────────────────────────
// 改用 user.temp_data.pendingProductId 綁定，同時支援 manager 與 consignor 上架流程，
// 修掉舊版 findLatestUntrained 兩人同時上架時照片會跑錯商品的 bug。
async function handleImage(env, event, user, userId, channel) {
    console.log(`[image] user.last_command=${user.last_command} temp_data=${JSON.stringify(user.temp_data)}`);
    if (user.last_command !== "WAITING_PRODUCT_PHOTOS") {
        console.log(`[image] state 不在 WAITING_PRODUCT_PHOTOS，忽略照片`);
        return new Response("OK");
    }
    const { productId, photoCount = 0 } = user.temp_data || {};
    if (!productId) {
        console.warn(`[image] temp_data 沒 productId，忽略`);
        return new Response("OK");
    }

    let trainData;
    try {
        trainData = await training.getOrCreateForProduct(env, productId);
    } catch (err) {
        console.error(`[image] getOrCreateForProduct throw:`, err?.stack || err?.message || err);
        return await line.replyText(env, channel, event.replyToken, `❌ 讀取訓練資料失敗：${err?.message || "unknown"}`);
    }
    const field = training.nextEmptyImageField(trainData);
    console.log(`[image] productId=${productId} photoCount=${photoCount} nextField=${field}`);
    if (!field) {
        console.warn(`[image] 4 個 image slot 都滿了，忽略`);
        return new Response("OK");
    }

    // channel 決定下載這張圖片要用哪支 bot 的 token（messageId 是 channel-scoped）。
    let url;
    try {
        url = await training.attachImage(env, channel, {
            messageId: event.message.id,
            productId,
            trainDataId: trainData.id,
            field,
        });
        console.log(`[image] attachImage 成功，url=${url}`);
    } catch (err) {
        console.error(`[image] attachImage throw:`, err?.stack || err?.message || err);
        return await line.replyText(env, channel, event.replyToken, `❌ 存照片失敗：${err?.message || "unknown"}`);
    }

    // 順便設封面（image1 或商品尚未設 image_url 時）
    const product = await products.getById(env, productId);
    if (product && (!product.image_url || field === "image1")) {
        await products.setImageUrl(env, productId, url);
    }

    // 依 field 決定 UX 文字（比用 photoCount 穩，因為 field 是從 training_data 實際狀態算出）。
    // image1 = 正面照；image2/3/4 = 側面照 1/3、2/3、3/3。
    const productName = product?.name || "";
    let reply;
    if (field === "image1") {
        reply = `✅ 已收到「${productName}」的正面照\n\n接下來請上傳側面照 3 張 📸`;
    } else if (field === "image2") {
        reply = `📸 已收到側面照（1/3）`;
    } else if (field === "image3") {
        reply = `📸 已收到側面照（2/3）`;
    } else {
        // image4 —— 最後一張
        if (product?.approval_status === "pending") {
            reply = `✅ 已收齊 4 張照片！「${productName}」已送出審核，等店長確認 🌲`;
        } else {
            reply = `✅【${productName}】照片收齊！`;
        }
    }

    const isFinal = field === "image4";
    if (isFinal) {
        await users.resetState(env, userId);
        // 若這批照片是 consignor 上架的 pending 商品 → 推 flex 給所有 manager 審核
        if (product?.approval_status === "pending") {
            const managers = await users.listManagers(env);
            const consignorRow = await users.getByLineId(env, userId);
            for (const m of managers) {
                await notifications.notifyManagerReview(env, {
                    managerLineId: m.line_id,
                    product,
                    coverPhotoUrl: url,
                    consignorNickname: consignorRow?.nickname,
                });
            }
        }
        return await line.replyText(env, channel, event.replyToken, reply);
    }

    // 尚未收齊 —— 更新 photoCount + 回覆進度
    await users.setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId, photoCount: photoCount + 1 });
    return await line.replyText(env, channel, event.replyToken, reply);
}

// ─── Role 判斷 helpers ───────────────────────────────────────────
function isManager(user) {
    return user?.role === "manager";
}
function isConsignor(user) {
    return user?.role === "consignor";
}
async function replyManagerOnly(env, channel, event) {
    return await line.replyText(env, channel, event.replyToken, "此指令僅限管理者使用。");
}
async function replyConsignorOnly(env, channel, event) {
    return await line.replyText(env, channel, event.replyToken, "此指令僅限寄賣者使用。");
}

// 「2026-07-15」→「7/15」— 給分潤紀錄行式輸出用。
function trimDate(iso) {
    if (!iso) return "?";
    const [_y, m, d] = iso.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
}
