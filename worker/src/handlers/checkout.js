// POST /checkout — React POS 送結帳資料 + 存證照片進來。
// Handler 只做「拆 form → 呼叫 services → 回 response」；業務邏輯全在 services/。
import * as transactions from "../services/transactions.js";
import * as products from "../services/products.js";
import * as users from "../services/users.js";
import * as notifications from "../services/notifications.js";

const CORS = { "Access-Control-Allow-Origin": "*" };

export async function handleCheckout(request, env) {
    try {
        const formData = await request.formData();
        const cart = JSON.parse(formData.get("cart_items"));
        const total = formData.get("total_amount");
        const type = formData.get("transaction_type");
        const photo = formData.get("photo");

        const { tx, photoUrl } = await transactions.create(env, { type, total, cart, photoBlob: photo });

        for (const item of cart) {
            await products.adjustStock(env, item.id, -(item.quantity || 1));
        }

        const managers = await users.listManagers(env);
        for (const m of managers) {
            await notifications.notifyManagerOfCheckout(env, {
                managerLineId: m.line_id,
                type,
                total,
                photoUrl,
                txId: tx.id,
                cart,
            });
        }

        return new Response(JSON.stringify({ status: "success" }), { headers: CORS });
    } catch (err) {
        return new Response(err.message, { status: 500, headers: CORS });
    }
}
