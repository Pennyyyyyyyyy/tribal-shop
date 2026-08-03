// LINE 通知與 flex message 組裝。所有「送 LINE」的成品邏輯集中在這。
import * as line from "../lib/line.js";
import * as members from "./members.js";

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

// 結帳完通知店長：先送存證照、再送文字。若賒帳，附上族人 quick reply。
export async function notifyManagerOfCheckout(env, { managerLineId, type, total, photoUrl, txId }) {
    const memberList = await members.listAllNicknames(env);
    const messages = [
        { type: "image", originalContentUrl: photoUrl, previewImageUrl: photoUrl },
        {
            type: "text",
            text: `🔔 結帳通知 (${type === "credit" ? "賒帳" : "現金"})\n金額: $${total}\n請確認：`,
            quickReply: type === "credit"
                ? {
                    items: memberList.slice(0, 12).map(m => ({
                        type: "action",
                        action: {
                            type: "postback",
                            label: m.nickname,
                            data: `action=confirm_debtor&tx_id=${txId}&name=${m.nickname}`,
                            displayText: `這是 ${m.nickname}`,
                        },
                    })),
                }
                : null,
        },
    ];
    return line.push(env, managerLineId, messages);
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
