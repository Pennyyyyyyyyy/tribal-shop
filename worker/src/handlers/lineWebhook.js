// POST /callback — LINE Messaging API 的 webhook 入口。
// 收到後分三種分支：postback（按鈕）、文字訊息、圖片訊息（訓練照片）。
// 對話狀態存在 users.last_command + users.temp_data，每個 handler 完事要 resetState。
import * as users from "../services/users.js";
import * as products from "../services/products.js";
import * as members from "../services/members.js";
import * as transactions from "../services/transactions.js";
import * as announcements from "../services/announcements.js";
import * as training from "../services/training.js";
import * as notifications from "../services/notifications.js";
import * as line from "../lib/line.js";

const PRODUCT_CATEGORIES = ["零食", "玩具", "日用品", "特色商品", "調味料", "泡麵"];

export async function handleLineWebhook(request, env) {
    try {
        const body = await request.json();
        if (!body.events || body.events.length === 0) return new Response("OK");

        const event = body.events[0];
        const userId = event.source.userId;
        const user = (await users.getByLineId(env, userId)) || (await users.autoRegister(env, userId));
        const currentState = user.last_command;

        if (event.type === "postback") {
            return await handlePostback(env, event, userId);
        }

        if (event.type === "message" && event.message.type === "text") {
            return await handleText(env, event, user, userId, currentState);
        }

        if (event.type === "message" && event.message.type === "image") {
            return await handleImage(env, event);
        }
    } catch (_err) {
        // 原本行為：LINE webhook 出錯也回 200 OK，不讓 LINE 平台 retry。
        return new Response("OK");
    }
    return new Response("OK");
}

// ─── Postback（按鈕點擊） ────────────────────────────────────────
async function handlePostback(env, event, userId) {
    const data = event.postback.data;
    const params = new URLSearchParams(data);
    const action = params.get("action");

    if (action === "confirm_debtor") {
        const txId = params.get("tx_id");
        const name = params.get("name");
        const tx = await transactions.getById(env, txId);
        const member = await members.getByNickname(env, name);
        if (tx && member) {
            await members.addDebtForTransaction(env, { memberId: member.id, txId, amount: tx.total });
            await transactions.setIdentity(env, txId, name);
            return await line.replyText(env, event.replyToken, `✅ 帳務更新成功！\n族人：${name}\n金額：$${tx.total}`);
        }
        return;
    }

    if (data === "action=inventory") {
        const list = await products.list(env);
        return await notifications.sendPicker(env, event.replyToken, "📦 選擇補貨商品", list, "select_stock_item");
    }

    if (action === "select_stock_item") {
        await users.setState(env, userId, "WAITING_STOCK_QTY", {
            id: params.get("id"),
            name: params.get("name"),
        });
        return await line.replyText(env, event.replyToken, `📝 已選：${params.get("name")}\n請輸入要「增加」的庫存數量：`);
    }

    if (data === "action=debt_menu") {
        const list = await members.list(env);
        return await notifications.sendPicker(env, event.replyToken, "💸 選擇除帳族人", list, "select_member_repay");
    }

    if (action === "select_member_repay") {
        await users.setState(env, userId, "WAITING_DEBT_INFO", {
            id: params.get("id"),
            name: params.get("name"),
        });
        return await line.replyText(env, event.replyToken, `💸 已選：${params.get("name")}\n請輸入族人「還款」的金額：`);
    }

    if (data === "action=new_product_menu") {
        await users.setState(env, userId, "WAITING_PRODUCT_INFO");
        return await line.replyText(
            env,
            event.replyToken,
            "📝 請輸入新商品資訊：\n[名稱] [價格] [分類] [庫存]\n\n分類：零食、玩具、日用品、特色商品、調味料、泡麵",
        );
    }

    if (data === "action=bulletin" || data === "bulletin") {
        await users.setState(env, userId, "WAITING_BULLETIN");
        return await line.replyText(env, event.replyToken, "📢 請直接輸入布告欄公告內容：");
    }
}

// ─── 文字訊息（含多步驟狀態） ────────────────────────────────────
async function handleText(env, event, user, userId, currentState) {
    const userMsg = event.message.text.trim();
    const p = userMsg.split(/\s+/);

    if (currentState === "WAITING_BULLETIN") {
        await announcements.create(env, { description: userMsg });
        await users.resetState(env, userId);
        return await line.replyText(env, event.replyToken, "✅ 公告發布成功！現場平板已同步更新。");
    }

    if (currentState === "WAITING_PRODUCT_INFO") {
        if (p.length < 4 || !PRODUCT_CATEGORIES.includes(p[2])) {
            return await line.replyText(env, event.replyToken, "❌ 格式錯誤。請輸入：[名稱] [價格] [分類] [庫存]");
        }
        await products.create(env, { name: p[0], price: p[1], category: p[2], stock: p[3] });
        await users.resetState(env, userId);
        return await line.replyText(env, event.replyToken, `✅【${p[0]}】建立成功，請傳送 4 張照片。`);
    }

    if (currentState === "WAITING_STOCK_QTY") {
        const qty = parseInt(userMsg);
        if (isNaN(qty)) return await line.replyText(env, event.replyToken, "❌ 請輸入數字。");
        const { id, name } = user.temp_data;
        const newStock = await products.adjustStock(env, id, qty);
        await products.recordRestock(env, id, qty);
        await users.resetState(env, userId);
        return await line.replyText(env, event.replyToken, `📦 ${name} 更新成功！目前：${newStock}`);
    }

    if (currentState === "WAITING_DEBT_INFO") {
        const qty = parseInt(userMsg);
        if (isNaN(qty) || qty <= 0) return await line.replyText(env, event.replyToken, "❌ 請輸入正確金額。");
        const { id, name } = user.temp_data;
        const newTotalDebt = await members.repay(env, id, qty);
        await users.resetState(env, userId);
        return await line.replyText(env, event.replyToken, `💸【除帳成功】\n族人：${name}\n目前總欠款：$${newTotalDebt}`);
    }

    if (userMsg.startsWith("查詢")) {
        const m = await members.getByNickname(env, p[1]);
        if (m) return await line.replyText(env, event.replyToken, `👤 ${p[1]} 欠款：$${m.total_debt}`);
    }
}

// ─── 圖片訊息（訓練照片） ────────────────────────────────────────
async function handleImage(env, event) {
    const product = await products.findLatestUntrained(env);
    if (!product) return;

    const trainData = await training.getOrCreateForProduct(env, product.id);
    const field = training.nextEmptyImageField(trainData);
    if (!field) return;

    const url = await training.attachImage(env, {
        messageId: event.message.id,
        productId: product.id,
        trainDataId: trainData.id,
        field,
    });

    // image1 或還沒設過 image_url → 順便設商品封面圖
    if (!product.image_url || field === "image1") {
        await products.setImageUrl(env, product.id, url);
    }

    if (field === "image4") {
        return await line.replyText(env, event.replyToken, `✅【${product.name}】照片收齊！`);
    }
    return await line.replyText(env, event.replyToken, `📸 收到第 ${field.slice(-1)} 張照片。`);
}
