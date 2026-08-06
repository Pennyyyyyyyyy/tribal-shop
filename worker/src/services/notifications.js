// LINE 通知與 flex message 組裝。所有「送 LINE」的成品邏輯集中在這。
import * as line from "../lib/line.js";
import * as supabase from "../lib/supabase.js";
import * as members from "./members.js";
import { taipeiToday, taipeiDayStart, taipeiDayEnd } from "../lib/time.js";

// 分潤入帳通知。summary 由 payouts.computePeriod 產出（含 consignor / items / 金額）。
// 純文字訊息（不用 flex）—— 店家品牌訊息，可讀性優先。
export async function notifyConsignorPayout(env, { lineId, summary }) {
    const { consignor, period_start, period_end, gross_amount, net_payout, items } = summary;
    const nickname = consignor?.nickname || "夥伴";
    const itemLines = items.length
        ? items.map(i => `${i.product_name}  $${i.unit_price} × ${i.quantity} = $${i.subtotal}`).join("\n")
        : "（無銷售明細）";
    const text =
        `💰 分潤入帳通知\n\n` +
        `您好 ${nickname}，\n` +
        `您在飛鼠商店 ${period_start} ~ ${period_end} 期間的\n` +
        `總銷售額：$ ${gross_amount}\n` +
        `實拿金額：$ ${net_payout}\n\n` +
        `銷售商品明細：\n${itemLines}`;
    const resp = await line.push(env, lineId, [{ type: "text", text }]);
    // fetch() 對 4xx / 5xx 不會 throw，這裡明確檢查讓 handler 的 try/catch 抓得到。
    if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        throw new Error(`LINE push failed (${resp.status}): ${errBody}`);
    }
    return resp;
}

// 結帳完通知店長：先送存證照、再送文字（含商品明細）。
// 賒帳才附族人 quick reply picker；現金就是純資訊、不用店長做任何事。
export async function notifyManagerOfCheckout(env, { managerLineId, type, total, photoUrl, txId, cart }) {
    const isCredit = type === "credit";
    const itemsBlock = formatItemsBlock(cart);

    let text = `🔔 結帳通知（${isCredit ? "賒帳" : "現金"}）\n金額：$${total}\n\n購買商品：\n${itemsBlock}`;
    if (isCredit) text += `\n\n請點選對應族人 ↓`;

    // 只有賒帳才需要查族人清單；現金結帳不需要（多一次 API call 無意義）。
    const quickReply = isCredit ? await buildDebtorQuickReply(env, txId) : null;

    const messages = [
        { type: "image", originalContentUrl: photoUrl, previewImageUrl: photoUrl },
        { type: "text", text, ...(quickReply ? { quickReply } : {}) },
    ];
    return line.push(env, managerLineId, messages);
}

// 把 cart 陣列格式化成「寶寶 × 1 = $130」多行文字。壞資料退回「(無明細)」。
function formatItemsBlock(cart) {
    if (!Array.isArray(cart) || cart.length === 0) return "（無明細）";
    return cart
        .map(it => {
            const name = it.name || `#${it.id}`;
            const qty = it.quantity || 1;
            const subtotal = (it.price || 0) * qty;
            return `${name} × ${qty} = $${subtotal}`;
        })
        .join("\n");
}

async function buildDebtorQuickReply(env, txId) {
    const memberList = await members.listAllNicknames(env);
    return {
        items: memberList.slice(0, 12).map(m => ({
            type: "action",
            action: {
                type: "postback",
                label: m.nickname,
                data: `action=confirm_debtor&tx_id=${txId}&name=${m.nickname}`,
                displayText: `這是 ${m.nickname}`,
            },
        })),
    };
}

// 通用 picker flex message：一列一個 item（圖 + 主標 + 副標）+ postback 到 actionType。
// 兼容 products (name / stock / image_url) 和 members (nickname / total_debt) 兩種 item。
export async function sendPicker(env, replyToken, title, items, actionType) {
    const rows = items.map(item => {
        const mainTitle = item.nickname || item.name;
        const subTitle = item.total_debt !== undefined ? `欠款: $${item.total_debt}` : `庫存: ${item.stock}`;
        return {
            type: "box",
            layout: "horizontal",
            paddingAll: "12px",
            contents: [
                {
                    type: "box",
                    layout: "vertical",
                    contents: [{
                        type: "image",
                        url: item.image_url || "https://via.placeholder.com/150",
                        aspectMode: "cover",
                    }],
                    width: "45px",
                    height: "45px",
                    cornerRadius: "4px",
                },
                {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: mainTitle, weight: "bold", size: "sm" },
                        { type: "text", text: subTitle, size: "xs", color: "#888888" },
                    ],
                    margin: "md",
                },
            ],
            action: {
                type: "postback",
                data: `action=${actionType}&id=${item.id}&name=${mainTitle}`,
                displayText: `選取 ${mainTitle}`,
            },
        };
    });

    // rows 之間插 separator；LINE bubble body 上限 25 個 contents，先截掉。
    const bodyContents = rows.flatMap((r, i) => (i === 0 ? [r] : [{ type: "separator" }, r])).slice(0, 25);

    const flex = {
        type: "flex",
        altText: title,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [{ type: "text", text: title, weight: "bold", size: "lg", color: "#1DB446" }],
            },
            body: { type: "box", layout: "vertical", spacing: "sm", contents: bodyContents },
        },
    };
    return line.reply(env, replyToken, [flex]);
}

// ─── 寄賣者 LINE 自助上架流程用的訊息 ──────────────────────────────

// 新好友加入 bot 時的歡迎詞。呼叫時機：follow event / autoRegister 後。
// 用 push 而非 reply（follow event 有 replyToken，但呼叫端不一定有；統一用 push 免踩坑）。
export async function notifyWelcome(env, lineId) {
    const text =
        `哈囉～歡迎來到飛鼠商店 🌲\n\n` +
        `在這裡你可以寄賣自己的商品：無論是手工餅乾、部落農產、獵到的馬告、繡製的飾品，都能透過我們的自助商店賣給來訪的客人。\n\n` +
        `店家會幫你收銀、代為結帳，每月月底跟你結算分潤 💰\n\n` +
        `為了讓我能記住你，我可以怎麼稱呼你呢？（直接輸入你的名字就好）`;
    return line.push(env, lineId, [{ type: "text", text }]);
}

// 寄賣者主選單 quick reply。設暱稱完 / 按取消回主選單 都用得到。
// 走 reply（消耗 replyToken）；handler 已經拿到 event.replyToken 直接傳進來。
export async function sendConsignorMenu(env, replyToken, greeting) {
    return line.reply(env, replyToken, [{
        type: "text",
        text: greeting || "需要協助什麼嗎？",
        quickReply: {
            items: [
                { type: "action", action: { type: "postback", label: "📤 上架商品", data: "action=consignor_upload_start", displayText: "上架商品" } },
                { type: "action", action: { type: "postback", label: "📋 我的商品", data: "action=consignor_list_own", displayText: "查看我的商品" } },
                { type: "action", action: { type: "message", label: "改暱稱", text: "/改暱稱" } },
            ],
        },
    }]);
}

// 寄賣者上架完 4 張照片 → 對所有 manager push 這個 flex 讓他們審核。
// hero 用第一張照片（若有），footer 兩顆按鈕帶 postback。
export async function notifyManagerReview(env, { managerLineId, product, coverPhotoUrl, consignorNickname }) {
    const p = product;
    const bubble = {
        type: "bubble",
        ...(coverPhotoUrl ? {
            hero: {
                type: "image",
                url: coverPhotoUrl,
                size: "full",
                aspectRatio: "1:1",
                aspectMode: "cover",
            },
        } : {}),
        body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
                { type: "text", text: "🆕 新寄賣商品待審", weight: "bold", color: "#1DB446", size: "sm" },
                { type: "text", text: p.name, weight: "bold", size: "xl", wrap: true },
                {
                    type: "box", layout: "vertical", margin: "md", spacing: "sm",
                    contents: [
                        kv("寄賣者", consignorNickname || p.consignor_line_id || "—"),
                        kv("售價", `$${p.price}`),
                        kv("分類", p.category || "—"),
                        kv("初始庫存", `${p.stock}`),
                    ],
                },
            ],
        },
        footer: {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
                {
                    type: "button", style: "secondary", height: "sm",
                    action: { type: "postback", label: "駁回", data: `action=reject_product&product_id=${p.id}`, displayText: "駁回" },
                },
                {
                    type: "button", style: "primary", color: "#1DB446", height: "sm",
                    action: { type: "postback", label: "同意上架", data: `action=approve_product&product_id=${p.id}`, displayText: "同意上架" },
                },
            ],
        },
    };
    return line.push(env, managerLineId, [{ type: "flex", altText: `新寄賣商品待審：${p.name}`, contents: bubble }]);
}

// flex bubble 中的 label:value 一行 —— 給 notifyManagerReview 內用。
function kv(label, value) {
    return {
        type: "box", layout: "baseline", spacing: "sm",
        contents: [
            { type: "text", text: label, color: "#888888", size: "sm", flex: 2 },
            { type: "text", text: String(value), size: "sm", flex: 5, wrap: true },
        ],
    };
}

// 通過審核 → 通知寄賣者。
export async function notifyConsignorApproval(env, consignorLineId, productName) {
    return line.push(env, consignorLineId, [{
        type: "text",
        text: `✅ 您的商品「${productName}」已通過審核，正式上架！\n\n祝賣個好價錢 🎉`,
    }]);
}

// 駁回 → 通知寄賣者，附原因。
export async function notifyConsignorRejection(env, consignorLineId, productName, reason) {
    const text =
        `❌ 您的商品「${productName}」未通過審核。\n\n` +
        `原因：${reason || "（店長未說明）"}\n\n` +
        `修正後可重新上傳。`;
    return line.push(env, consignorLineId, [{ type: "text", text }]);
}

// ─── Cron trigger：每天台北 23:00 寄賣者當日銷售彙總 ─────────────────

// 對每位有銷售的寄賣者 push 一則今日銷售摘要。0 銷售者跳過。
// 走多次查詢 + JS 聚合（同 consignors / payouts service 的 pattern，不用 PostgREST embed）。
// 單一 push 失敗（例如族人封鎖 bot）不影響其他人 → 用 Promise.allSettled。
export async function dailyConsignorDigest(env) {
    try {
        // 1. 所有寄賣者
        const consignors = await supabase.query(env, "/rest/v1/users?role=eq.consignor&select=line_id,nickname");
        if (!Array.isArray(consignors) || consignors.length === 0) return;

        // 2. 今日交易 id（台北時區 00:00 ~ 23:59）
        const today = taipeiToday();
        const startISO = encodeURIComponent(taipeiDayStart(today));
        const endISO = encodeURIComponent(taipeiDayEnd(today));
        const txs = await supabase.query(
            env,
            `/rest/v1/transaction?created_at=gte.${startISO}&created_at=lte.${endISO}&select=id`,
        );
        if (!Array.isArray(txs) || txs.length === 0) return;

        // 3. 這批交易的寄賣 line items
        const txIds = txs.map(t => t.id).join(",");
        const items = await supabase.query(
            env,
            `/rest/v1/transaction_items?consignor_line_id=not.is.null&transaction_id=in.(${txIds})&select=consignor_line_id,product_id,quantity,unit_price`,
        );
        if (!Array.isArray(items) || items.length === 0) return;

        // 4. 涉及的商品名字（orphan 顯示「(已刪除商品 #<id>)」）
        const productIds = [...new Set(items.map(i => i.product_id).filter(id => id != null))];
        const nameMap = new Map();
        if (productIds.length > 0) {
            const products = await supabase.query(env, `/rest/v1/products?id=in.(${productIds.join(",")})&select=id,name`);
            for (const p of (Array.isArray(products) ? products : [])) nameMap.set(p.id, p.name);
        }

        // 5. group by consignor → group by product 聚合
        const byConsignor = new Map();
        for (const it of items) {
            const key = it.consignor_line_id;
            if (!byConsignor.has(key)) byConsignor.set(key, new Map());
            const perProd = byConsignor.get(key);
            const prev = perProd.get(it.product_id) || { quantity: 0, subtotal: 0 };
            prev.quantity += it.quantity;
            prev.subtotal += it.quantity * it.unit_price;
            perProd.set(it.product_id, prev);
        }

        // 6. 對每位有銷售的 consignor 組訊息 + 平行 push
        const nickByLine = new Map(consignors.map(c => [c.line_id, c.nickname]));
        const pushes = [];
        for (const [lineId, perProd] of byConsignor) {
            const nickname = nickByLine.get(lineId);
            const lines = [];
            let total = 0;
            for (const [pid, agg] of perProd) {
                const name = nameMap.get(pid) || `(已刪除商品 #${pid})`;
                lines.push(`${name} × ${agg.quantity} = $${agg.subtotal}`);
                total += agg.subtotal;
            }
            const header = nickname
                ? `📊 ${nickname}，今日銷售摘要（${today}）`
                : `📊 今日銷售摘要（${today}）`;
            const text = `${header}\n\n${lines.join("\n")}\n\n今日總銷售：$${total}`;
            pushes.push(line.push(env, lineId, [{ type: "text", text }]));
        }
        await Promise.allSettled(pushes);
    } catch {
        // cron 失敗吞掉 —— Cloudflare 不會 retry scheduled events，也沒必要拋讓 logs 更難看。
    }
}
