export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // --- 0. CORS 處理 ---
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        // --- 1. React 前端結帳入口 (/checkout) ---
        if (request.method === "POST" && url.pathname === "/checkout") {
            try {
                const formData = await request.formData();
                const cart = JSON.parse(formData.get("cart_items"));
                const total = formData.get("total_amount");
                const type = formData.get("transaction_type");
                const photo = formData.get("photo");

                const photoUrl = await uploadEvidence(env, photo);
                const tx = await supabasePostReturn(env, '/rest/v1/transaction', {
                    type: type, total: parseInt(total), item_list: JSON.stringify(cart),
                    checkout_image: photoUrl, identity: type === "credit" ? "待確認族人" : "遊客"
                });

                for (const item of cart) {
                    const p = await supabaseQuery(env, `/rest/v1/products?id=eq.${item.id}&select=stock`);
                    if (p.length > 0) {
                        await supabasePatch(env, `/rest/v1/products?id=eq.${item.id}`, { stock: (p[0].stock || 0) - (item.quantity || 1) });
                    }
                }

                const managers = await supabaseQuery(env, "/rest/v1/users?role=eq.manager&select=line_id");
                for (const m of managers) {
                    await notifyManager(env, m.line_id, type, total, photoUrl, tx.id);
                }

                return new Response(JSON.stringify({ status: "success" }), { headers: { "Access-Control-Allow-Origin": "*" } });
            } catch (err) {
                return new Response(err.message, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
            }
        }

        // --- 2. LINE Webhook 入口 (/callback) ---
        if (request.method === "POST" && (url.pathname === "/callback" || url.pathname === "/")) {
            try {
                const body = await request.json();
                if (!body.events || body.events.length === 0) return new Response("OK");

                const event = body.events[0];
                const userId = event.source.userId;
                const user = (await supabaseQuery(env, `/rest/v1/users?line_id=eq.${userId}&select=*`))[0] || await autoRegister(env, userId);
                const currentState = user.last_command;

                // --- A. Postback 處理 ---
                if (event.type === "postback") {
                    const data = event.postback.data;
                    const params = new URLSearchParams(data);
                    const action = params.get("action");

                    if (action === "confirm_debtor") {
                        const txId = params.get("tx_id");
                        const name = params.get("name");
                        const tx = await supabaseQuery(env, `/rest/v1/transaction?id=eq.${txId}`);
                        const member = await supabaseQuery(env, `/rest/v1/member?nickname=eq.${name}`);
                        if (tx.length && member.length) {
                            const amount = tx[0].total;
                            await supabasePost(env, '/rest/v1/credit', { member_id: member[0].id, transaction_id: txId, transaction_total: amount });
                            await supabasePatch(env, `/rest/v1/member?id=eq.${member[0].id}`, { total_debt: (member[0].total_debt || 0) + amount });
                            await supabasePatch(env, `/rest/v1/transaction?id=eq.${txId}`, { identity: name });
                            return await replyLine(env, event.replyToken, `✅ 帳務更新成功！\n族人：${name}\n金額：$${amount}`);
                        }
                    }

                    if (data === "action=inventory") {
                        const products = await supabaseQuery(env, "/rest/v1/products?select=id,name,stock,image_url&order=name");
                        return await _sendPicker(env, event.replyToken, "📦 選擇補貨商品", products, "select_stock_item");
                    }

                    if (action === "select_stock_item") {
                        await supabasePatch(env, `/rest/v1/users?line_id=eq.${userId}`, {
                            last_command: "WAITING_STOCK_QTY",
                            temp_data: { id: params.get("id"), name: params.get("name") }
                        });
                        return await replyLine(env, event.replyToken, `📝 已選：${params.get("name")}\n請輸入要「增加」的庫存數量：`);
                    }

                    if (data === "action=debt_menu") {
                        const members = await supabaseQuery(env, "/rest/v1/member?select=id,nickname,total_debt&order=nickname");
                        return await _sendPicker(env, event.replyToken, "💸 選擇除帳族人", members, "select_member_repay");
                    }

                    if (action === "select_member_repay") {
                        await supabasePatch(env, `/rest/v1/users?line_id=eq.${userId}`, {
                            last_command: "WAITING_DEBT_INFO",
                            temp_data: { id: params.get("id"), name: params.get("name") }
                        });
                        return await replyLine(env, event.replyToken, `💸 已選：${params.get("name")}\n請輸入族人「還款」的金額：`);
                    }

                    if (data === "action=new_product_menu") {
                        await supabasePatch(env, `/rest/v1/users?line_id=eq.${userId}`, { last_command: "WAITING_PRODUCT_INFO" });
                        return await replyLine(env, event.replyToken, "📝 請輸入新商品資訊：\n[名稱] [價格] [分類] [庫存]\n\n分類：零食、玩具、日用品、特色商品、調味料、泡麵");
                    }

                    // 💡 補回：點擊布告欄選單
                    if (data === "action=bulletin" || data === "bulletin") {
                        await supabasePatch(env, `/rest/v1/users?line_id=eq.${userId}`, { last_command: "WAITING_BULLETIN" });
                        return await replyLine(env, event.replyToken, "📢 請直接輸入布告欄公告內容：");
                    }
                }

                // --- B. 文字訊息處理 ---
                if (event.type === "message" && event.message.type === "text") {
                    const userMsg = event.message.text.trim();
                    const p = userMsg.split(/\s+/);

                    // 💡 補回：處理公告存檔
                    if (currentState === "WAITING_BULLETIN") {
                        await supabasePost(env, '/rest/v1/announcement', {
                            title: "店長廣播",
                            description: userMsg,
                            upload_time: new Date().toISOString()
                        });
                        await resetState(env, userId);
                        return await replyLine(env, event.replyToken, "✅ 公告發布成功！現場平板已同步更新。");
                    }

                    if (currentState === "WAITING_PRODUCT_INFO") {
                        const categories = ["零食", "玩具", "日用品", "特色商品", "調味料", "泡麵"];
                        if (p.length < 4 || !categories.includes(p[2])) {
                            return await replyLine(env, event.replyToken, "❌ 格式錯誤。請輸入：[名稱] [價格] [分類] [庫存]");
                        }
                        const product = await supabasePostReturn(env, '/rest/v1/products', { name: p[0], price: parseInt(p[1]), category: p[2], stock: parseInt(p[3]), trained: false });
                        await supabasePost(env, '/rest/v1/training_data', { product_id: product.id, english_name: "PENDING" });
                        await resetState(env, userId);
                        return await replyLine(env, event.replyToken, `✅【${p[0]}】建立成功，請傳送 4 張照片。`);
                    }

                    if (currentState === "WAITING_STOCK_QTY") {
                        const qty = parseInt(userMsg);
                        if (isNaN(qty)) return await replyLine(env, event.replyToken, "❌ 請輸入數字。");
                        const { id, name } = user.temp_data;
                        const res = await supabaseQuery(env, `/rest/v1/products?id=eq.${id}&select=stock`);
                        await supabasePatch(env, `/rest/v1/products?id=eq.${id}`, { stock: (res[0].stock || 0) + qty });
                        await supabasePost(env, '/rest/v1/stock', { product_id: id, quantity: qty, restock_date: new Date().toISOString().split('T')[0] });
                        await resetState(env, userId);
                        return await replyLine(env, event.replyToken, `📦 ${name} 更新成功！目前：${(res[0].stock || 0) + qty}`);
                    }

                    if (currentState === "WAITING_DEBT_INFO") {
                        const qty = parseInt(userMsg);
                        if (isNaN(qty) || qty <= 0) return await replyLine(env, event.replyToken, "❌ 請輸入正確金額。");
                        const { id, name } = user.temp_data;
                        const member = (await supabaseQuery(env, `/rest/v1/member?id=eq.${id}`))[0];
                        const newTotalDebt = Math.max(0, (member.total_debt || 0) - qty);
                        await supabasePatch(env, `/rest/v1/member?id=eq.${id}`, { total_debt: newTotalDebt });
                        await resetState(env, userId);
                        return await replyLine(env, event.replyToken, `💸【除帳成功】\n族人：${name}\n目前總欠款：$${newTotalDebt}`);
                    }

                    if (userMsg.startsWith("查詢")) {
                        const m = await supabaseQuery(env, `/rest/v1/member?nickname=eq.${p[1]}&select=*`);
                        if (m.length) return await replyLine(env, event.replyToken, `👤 ${p[1]} 欠款：$${m[0].total_debt}`);
                    }
                }

                // --- C. 訓練圖片處理 ---
                if (event.type === "message" && event.message.type === "image") {
                    const last = await supabaseQuery(env, `/rest/v1/products?trained=eq.false&order=id.desc&limit=1`);
                    if (last.length > 0) {
                        const product = last[0];
                        let trainData = (await supabaseQuery(env, `/rest/v1/training_data?product_id=eq.${product.id}`))[0]
                            || await supabasePostReturn(env, '/rest/v1/training_data', { product_id: product.id, english_name: "PENDING" });

                        let field = !trainData.image1 ? "image1" : !trainData.image2 ? "image2" : !trainData.image3 ? "image3" : !trainData.image4 ? "image4" : "";
                        if (field) {
                            const url = await uploadToStorage(env, event.message.id, product.id, field);
                            await supabasePatch(env, `/rest/v1/training_data?id=eq.${trainData.id}`, { [field]: url });
                            if (!product.image_url || field === "image1") await supabasePatch(env, `/rest/v1/products?id=eq.${product.id}`, { image_url: url });
                            if (field === "image4") return await replyLine(env, event.replyToken, `✅【${product.name}】照片收齊！`);
                            return await replyLine(env, event.replyToken, `📸 收到第 ${field.slice(-1)} 張照片。`);
                        }
                    }
                }
            } catch (err) { return new Response("OK"); }
        }
        return new Response("OK");
    }
};

// --- 輔助函式庫 (包含 _sendPicker 等) ---
async function _sendPicker(env, replyToken, title, items, actionType) {
    const rows = items.map(item => {
        const mainTitle = item.nickname || item.name;
        const subTitle = item.total_debt !== undefined ? `欠款: $${item.total_debt}` : `庫存: ${item.stock}`;
        return {
            "type": "box", "layout": "horizontal", "paddingAll": "12px",
            "contents": [
                { "type": "box", "layout": "vertical", "contents": [{ "type": "image", "url": item.image_url || "https://via.placeholder.com/150", "aspectMode": "cover" }], "width": "45px", "height": "45px", "cornerRadius": "4px" },
                {
                    "type": "box", "layout": "vertical", "contents": [
                        { "type": "text", "text": mainTitle, "weight": "bold", "size": "sm" },
                        { "type": "text", "text": subTitle, "size": "xs", "color": "#888888" }
                    ], "margin": "md"
                }
            ],
            "action": { "type": "postback", "data": `action=${actionType}&id=${item.id}&name=${mainTitle}`, "displayText": `選取 ${mainTitle}` }
        };
    });
    const flex = {
        "type": "flex", "altText": title,
        "contents": {
            "type": "bubble",
            "header": { "type": "box", "layout": "vertical", "contents": [{ "type": "text", "text": title, "weight": "bold", "size": "lg", "color": "#1DB446" }] },
            "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": rows.flatMap((r, i) => i === 0 ? [r] : [{ "type": "separator" }, r]).slice(0, 25) }
        }
    };
    return fetch("https://api.line.me/v2/bot/message/reply", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` }, body: JSON.stringify({ replyToken, messages: [flex] }) });
}

async function uploadEvidence(env, blob) {
    const path = `evidence_${Date.now()}.jpg`;
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/evidence/${path}`, { method: "POST", headers: { "apikey": env.SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "image/jpeg" }, body: blob });
    return `${env.SUPABASE_URL}/storage/v1/object/public/evidence/${path}`;
}

async function notifyManager(env, lineId, type, total, photoUrl, txId) {
    const members = await supabaseQuery(env, "/rest/v1/member?select=nickname");
    const messages = [
        { type: "image", originalContentUrl: photoUrl, previewImageUrl: photoUrl },
        {
            type: "text", text: `🔔 結帳通知 (${type === 'credit' ? '賒帳' : '現金'})\n金額: $${total}\n請確認：`,
            quickReply: type === 'credit' ? { items: members.slice(0, 12).map(m => ({ type: "action", action: { type: "postback", label: m.nickname, data: `action=confirm_debtor&tx_id=${txId}&name=${m.nickname}`, displayText: `這是 ${m.nickname}` } })) } : null
        }
    ];
    return fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` }, body: JSON.stringify({ to: lineId, messages }) });
}

async function uploadToStorage(env, messageId, productId, fileName) {
    const lineRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, { headers: { "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` } });
    const blob = await lineRes.blob();
    const path = `${productId}/${fileName}.jpg`;
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/products/${path}`, { method: "POST", headers: { "apikey": env.SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: blob });
    return `${env.SUPABASE_URL}/storage/v1/object/public/products/${path}`;
}

async function supabaseQuery(env, path) { const r = await fetch(`${env.SUPABASE_URL}${path}`, { headers: { "apikey": env.SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }); return r.json(); }
async function supabasePost(env, path, body) { return fetch(`${env.SUPABASE_URL}${path}`, { method: "POST", headers: { "apikey": env.SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
async function supabasePostReturn(env, path, body) { const r = await fetch(`${env.SUPABASE_URL}${path}`, { method: "POST", headers: { "apikey": env.SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" }, body: JSON.stringify(body) }); const data = await r.json(); return data[0]; }
async function supabasePatch(env, path, body) { return fetch(`${env.SUPABASE_URL}${path}`, { method: "PATCH", headers: { "apikey": env.SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
async function replyLine(env, replyToken, text) { return fetch("https://api.line.me/v2/bot/message/reply", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` }, body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }) }); }
async function resetState(env, userId) { return await supabasePatch(env, `/rest/v1/users?line_id=eq.${userId}`, { last_command: null }); }
async function autoRegister(env, userId) { const newUser = { line_id: userId, nickname: '新夥伴', role: 'consignor' }; await supabasePost(env, '/rest/v1/users', newUser); return newUser; }