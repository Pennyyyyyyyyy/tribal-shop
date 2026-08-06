// POST /callback — LINE Messaging API 的 webhook 入口。
// 收到後依 event.type 分四種分支：
//   follow      → 新好友 → autoRegister（consignor）+ 歡迎詞 + 問暱稱
//   postback    → 按鈕點擊
//   text 訊息   → 多步驟狀態機 + role-routed 指令
//   image 訊息  → 上架流程照片（改用 user.temp_data.pendingProductId，
//                 修掉舊版 findLatestUntrained 兩人同時上架撞單 bug）
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
import * as supabase from "../lib/supabase.js";
import * as line from "../lib/line.js";

const PRODUCT_CATEGORIES = ["零食", "玩具", "日用品", "特色商品", "調味料", "泡麵"];

const APPROVAL_LABEL = {
    pending: "待審核",
    approved: "已上架",
    rejected: "已駁回",
};

export async function handleLineWebhook(request, env) {
    try {
        const body = await request.json();
        if (!body.events || body.events.length === 0) return new Response("OK");

        const event = body.events[0];
        const userId = event.source.userId;

        // follow event 也要先把使用者建起來，之後所有 handler 都可以拿到 user row。
        const user = (await users.getByLineId(env, userId)) || (await users.autoRegister(env, userId));

        if (event.type === "follow") {
            return await handleFollow(env, event, userId);
        }
        if (event.type === "postback") {
            return await handlePostback(env, event, user, userId);
        }
        if (event.type === "message" && event.message.type === "text") {
            return await handleText(env, event, user, userId, user.last_command);
        }
        if (event.type === "message" && event.message.type === "image") {
            return await handleImage(env, event, user, userId);
        }
    } catch (_err) {
        return new Response("OK");
    }
    return new Response("OK");
}

// ─── Follow：新好友歡迎 ────────────────────────────────────────────
async function handleFollow(env, event, userId) {
    await users.setState(env, userId, "WAITING_NICKNAME");
    // notifyWelcome 內含歡迎介紹 + 「我可以怎麼稱呼你呢？」引導
    await notifications.notifyWelcome(env, userId);
    return new Response("OK");
}

// ─── Postback（按鈕點擊） ────────────────────────────────────────
async function handlePostback(env, event, user, userId) {
    const data = event.postback.data;
    const params = new URLSearchParams(data);
    const action = params.get("action");

    // ── 通用（不分身份，但目前實際上都是 manager 才會收到）──
    if (action === "confirm_debtor") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        const txId = params.get("tx_id");
        const name = params.get("name");
        const tx = await transactions.getById(env, txId);
        const member = await members.getByNickname(env, name);
        if (tx && member) {
            await members.addDebtForTransaction(env, { memberId: member.id, txId, amount: tx.total });
            await transactions.setIdentity(env, txId, name);
            return await line.replyText(env, event.replyToken, `✅ 帳務更新成功！\n族人：${name}\n金額：$${tx.total}`);
        }
        return new Response("OK");
    }

    // ── Manager 專用 ────────────────────────────────────────────
    if (data === "action=inventory") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        const list = await products.list(env);
        return await notifications.sendPicker(env, event.replyToken, "📦 選擇補貨商品", list, "select_stock_item");
    }

    if (action === "select_stock_item") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        await users.setState(env, userId, "WAITING_STOCK_QTY", {
            id: params.get("id"),
            name: params.get("name"),
        });
        return await line.replyText(env, event.replyToken, `📝 已選：${params.get("name")}\n請輸入要「增加」的庫存數量：`);
    }

    if (data === "action=debt_menu") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        const list = await members.list(env);
        return await notifications.sendPicker(env, event.replyToken, "💸 選擇除帳族人", list, "select_member_repay");
    }

    if (action === "select_member_repay") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        await users.setState(env, userId, "WAITING_DEBT_INFO", {
            id: params.get("id"),
            name: params.get("name"),
        });
        return await line.replyText(env, event.replyToken, `💸 已選：${params.get("name")}\n請輸入族人「還款」的金額：`);
    }

    if (data === "action=new_product_menu") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        await users.setState(env, userId, "WAITING_PRODUCT_INFO");
        return await line.replyText(
            env,
            event.replyToken,
            "📝 請輸入新商品資訊：\n[名稱] [價格] [分類] [庫存]\n\n分類：零食、玩具、日用品、特色商品、調味料、泡麵",
        );
    }

    if (data === "action=bulletin" || data === "bulletin") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        await users.setState(env, userId, "WAITING_BULLETIN");
        return await line.replyText(env, event.replyToken, "📢 請直接輸入布告欄公告內容：");
    }

    // 商品審核 —— 只 manager 能按
    if (action === "approve_product") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        const productId = params.get("product_id");
        const product = await products.getById(env, productId);
        if (!product) return await line.replyText(env, event.replyToken, "❌ 找不到商品。");
        if (product.approval_status !== "pending") {
            return await line.replyText(env, event.replyToken, `此商品已被處理（目前狀態：${APPROVAL_LABEL[product.approval_status] || product.approval_status}）。`);
        }
        await products.approve(env, productId);
        if (product.consignor_line_id) {
            await notifications.notifyConsignorApproval(env, product.consignor_line_id, product.name);
        }
        return await line.replyText(env, event.replyToken, `✅ 已同意上架：${product.name}`);
    }

    if (action === "reject_product") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        const productId = params.get("product_id");
        const product = await products.getById(env, productId);
        if (!product) return await line.replyText(env, event.replyToken, "❌ 找不到商品。");
        if (product.approval_status !== "pending") {
            return await line.replyText(env, event.replyToken, `此商品已被處理（目前狀態：${APPROVAL_LABEL[product.approval_status] || product.approval_status}）。`);
        }
        await users.setState(env, userId, "WAITING_REJECT_REASON", { productId });
        return await line.replyText(env, event.replyToken, "📝 請輸入駁回原因（會通知寄賣者、寫入 DB）：");
    }

    // ── Consignor 專用 ──────────────────────────────────────────
    if (action === "consignor_upload_start") {
        if (!isConsignor(user)) return await replyConsignorOnly(env, event);
        await users.setState(env, userId, "WAITING_CONSIGNOR_PRODUCT_INFO");
        return await line.replyText(
            env,
            event.replyToken,
            "📝 請輸入商品資訊（用空格分隔）：\n[名稱] [價格] [分類] [初始庫存]\n\n分類：零食、玩具、日用品、特色商品、調味料、泡麵\n例：手工餅乾 50 零食 20",
        );
    }

    if (action === "consignor_list_own") {
        if (!isConsignor(user)) return await replyConsignorOnly(env, event);
        const rows = await supabase.query(
            env,
            `/rest/v1/products?consignor_line_id=eq.${encodeURIComponent(userId)}&select=id,name,stock,approval_status,rejected_reason&order=id.desc`,
        );
        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) {
            return await line.replyText(env, event.replyToken, "你還沒上架任何商品。");
        }
        const lines = list.map((p, i) => {
            const label = APPROVAL_LABEL[p.approval_status] || p.approval_status;
            let extra = "";
            if (p.approval_status === "approved") extra = ` · 庫存 ${p.stock}`;
            else if (p.approval_status === "rejected" && p.rejected_reason) extra = `：${p.rejected_reason}`;
            return `${i + 1}. ${p.name}（${label}${extra}）`;
        });
        return await line.replyText(env, event.replyToken, `📋 你的商品：\n${lines.join("\n")}`);
    }

    return new Response("OK");
}

// ─── 文字訊息（含多步驟狀態） ────────────────────────────────────
async function handleText(env, event, user, userId, currentState) {
    const userMsg = event.message.text.trim();
    const p = userMsg.split(/\s+/);

    // ── 通用指令（不吃 state）──
    if (userMsg === "/改暱稱") {
        await users.setState(env, userId, "WAITING_NICKNAME");
        return await line.replyText(env, event.replyToken, "好的，請輸入新暱稱：");
    }

    // ── 狀態機 ───────────────────────────────────────────────
    if (currentState === "WAITING_NICKNAME") {
        if (!userMsg) {
            return await line.replyText(env, event.replyToken, "請輸入非空白暱稱：");
        }
        await users.updateNickname(env, userId, userMsg);
        await users.resetState(env, userId);
        // 依身份給不同的引導選單；預設走 consignor menu（新加好友場景）。
        if (isManager(user)) {
            return await line.replyText(env, event.replyToken, `太好了，${userMsg}！暱稱已更新。`);
        }
        return await notifications.sendConsignorMenu(
            env,
            event.replyToken,
            `太好了，${userMsg}！以下是你可以做的事：`,
        );
    }

    if (currentState === "WAITING_BULLETIN") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        await announcements.create(env, { description: userMsg });
        await users.resetState(env, userId);
        return await line.replyText(env, event.replyToken, "✅ 公告發布成功！現場平板已同步更新。");
    }

    if (currentState === "WAITING_PRODUCT_INFO") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        if (p.length < 4 || !PRODUCT_CATEGORIES.includes(p[2])) {
            return await line.replyText(env, event.replyToken, "❌ 格式錯誤。請輸入：[名稱] [價格] [分類] [庫存]");
        }
        const product = await products.create(env, { name: p[0], price: p[1], category: p[2], stock: p[3] });
        // 進入照片收集狀態（統一走 WAITING_PRODUCT_PHOTOS，讓 handleImage 用 temp_data 對應）。
        await users.setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId: product.id, photoCount: 0 });
        return await line.replyText(env, event.replyToken, `✅【${p[0]}】建立成功，請傳送 4 張照片。`);
    }

    if (currentState === "WAITING_CONSIGNOR_PRODUCT_INFO") {
        if (!isConsignor(user)) return await replyConsignorOnly(env, event);
        if (p.length < 4 || !PRODUCT_CATEGORIES.includes(p[2])) {
            return await line.replyText(env, event.replyToken, "❌ 格式錯誤。請輸入：[名稱] [價格] [分類] [初始庫存]\n分類：零食、玩具、日用品、特色商品、調味料、泡麵");
        }
        const product = await products.createPending(env, {
            name: p[0],
            price: p[1],
            category: p[2],
            stock: p[3],
            consignorLineId: userId,
        });
        await users.setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId: product.id, photoCount: 0 });
        return await line.replyText(env, event.replyToken, `✅ 商品「${p[0]}」建立成功！\n請傳送 4 張商品照片（將用於現場辨識）。`);
    }

    if (currentState === "WAITING_STOCK_QTY") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        const qty = parseInt(userMsg);
        if (isNaN(qty)) return await line.replyText(env, event.replyToken, "❌ 請輸入數字。");
        const { id, name } = user.temp_data;
        const newStock = await products.adjustStock(env, id, qty);
        await products.recordRestock(env, id, qty);
        await users.resetState(env, userId);
        return await line.replyText(env, event.replyToken, `📦 ${name} 更新成功！目前：${newStock}`);
    }

    if (currentState === "WAITING_DEBT_INFO") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        const qty = parseInt(userMsg);
        if (isNaN(qty) || qty <= 0) return await line.replyText(env, event.replyToken, "❌ 請輸入正確金額。");
        const { id, name } = user.temp_data;
        const newTotalDebt = await members.repay(env, id, qty);
        await users.resetState(env, userId);
        return await line.replyText(env, event.replyToken, `💸【除帳成功】\n族人：${name}\n目前總欠款：$${newTotalDebt}`);
    }

    if (currentState === "WAITING_REJECT_REASON") {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        const { productId } = user.temp_data || {};
        if (!productId) {
            await users.resetState(env, userId);
            return await line.replyText(env, event.replyToken, "找不到要駁回的商品，動作取消。");
        }
        const product = await products.getById(env, productId);
        if (!product) {
            await users.resetState(env, userId);
            return await line.replyText(env, event.replyToken, "商品已消失，動作取消。");
        }
        // 先通知寄賣者；通知失敗就不 update DB（保留 pending 給店長重試）。
        if (product.consignor_line_id) {
            try {
                await notifications.notifyConsignorRejection(env, product.consignor_line_id, product.name, userMsg);
            } catch (err) {
                await users.resetState(env, userId);
                return await line.replyText(env, event.replyToken, `❌ LINE 通知失敗，未駁回：${err.message}`);
            }
        }
        await products.reject(env, productId, userMsg);
        await users.resetState(env, userId);
        return await line.replyText(env, event.replyToken, `❌ 已駁回：${product.name}\n原因：${userMsg}`);
    }

    // ── 非狀態指令 ───────────────────────────────────────────
    if (userMsg.startsWith("查詢")) {
        if (!isManager(user)) return await replyManagerOnly(env, event);
        const m = await members.getByNickname(env, p[1]);
        if (m) return await line.replyText(env, event.replyToken, `👤 ${p[1]} 欠款：$${m.total_debt}`);
    }

    return new Response("OK");
}

// ─── 圖片訊息（訓練照片） ────────────────────────────────────────
// 改用 user.temp_data.pendingProductId 綁定，同時支援 manager 與 consignor 上架流程，
// 修掉舊版 findLatestUntrained 兩人同時上架時照片會跑錯商品的 bug。
async function handleImage(env, event, user, userId) {
    if (user.last_command !== "WAITING_PRODUCT_PHOTOS") {
        return new Response("OK");
    }
    const { productId, photoCount = 0 } = user.temp_data || {};
    if (!productId) return new Response("OK");

    const trainData = await training.getOrCreateForProduct(env, productId);
    const field = training.nextEmptyImageField(trainData);
    if (!field) return new Response("OK");

    const url = await training.attachImage(env, {
        messageId: event.message.id,
        productId,
        trainDataId: trainData.id,
        field,
    });

    // 順便設封面（image1 或商品尚未設 image_url 時）
    const product = await products.getById(env, productId);
    if (product && (!product.image_url || field === "image1")) {
        await products.setImageUrl(env, productId, url);
    }

    const newCount = photoCount + 1;
    if (newCount >= 4 || field === "image4") {
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
            return await line.replyText(env, event.replyToken, `📸 已收齊 4 張照片，「${product.name}」已送出審核，等店長確認！`);
        }
        return await line.replyText(env, event.replyToken, `✅【${product?.name || ""}】照片收齊！`);
    }

    await users.setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId, photoCount: newCount });
    return await line.replyText(env, event.replyToken, `📸 收到第 ${newCount} 張照片。`);
}

// ─── Role 判斷 helpers ───────────────────────────────────────────
function isManager(user) {
    return user?.role === "manager";
}
function isConsignor(user) {
    return user?.role === "consignor";
}
async function replyManagerOnly(env, event) {
    return await line.replyText(env, event.replyToken, "此指令僅限管理者使用。");
}
async function replyConsignorOnly(env, event) {
    return await line.replyText(env, event.replyToken, "此指令僅限寄賣者使用。");
}
