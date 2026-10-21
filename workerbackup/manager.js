// workerbackup/manager.js - 店長專屬模組 (店長選單、商品上架與 AI 特徵學習、審核駁回、庫存除帳、通知推播)

import {
  query,
  reply,
  replyText,
  push,
  replyManagerOnly,
  setState,
  resetState,
  isManager,
  listProducts,
  getProductById,
  createProduct,
  approveProduct,
  rejectProduct,
  adjustStock,
  recordRestock,
  setImageUrl,
  enqueueEmbeddingJob,
  getOrCreateForProduct,
  nextEmptyImageField,
  attachImage,
  listMembers,
  listAllNicknames,
  getMemberByNickname,
  addDebtForTransaction,
  repayDebt,
  getTransactionById,
  setTransactionIdentity,
  createAnnouncement,
  listManagers,
  PRODUCT_CATEGORIES,
  APPROVAL_LABEL,
  kv
} from "./common.js";

// ============================================================
// 1. 店長專屬通知與介面元件
// ============================================================

export function formatItemsBlock(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return "（無明細）";
  return cart.map((it) => {
    const name = it.name || `#${it.id}`;
    const qty = it.quantity || 1;
    const subtotal = (it.price || 0) * qty;
    return `${name} × ${qty} = $${subtotal}`;
  }).join("\n");
}

export async function buildDebtorQuickReply(env, txId) {
  const memberList = await listAllNicknames(env);
  return {
    items: memberList.slice(0, 12).map((m) => ({
      type: "action",
      action: {
        type: "postback",
        label: m.nickname,
        data: `action=confirm_debtor&tx_id=${txId}&name=${m.nickname}`,
        displayText: `這是 ${m.nickname}`
      }
    }))
  };
}

export async function sendPicker(env, replyToken, title, items, actionType) {
  const rows = items.map((item) => {
    const mainTitle = item.nickname || item.name;
    const subTitle = item.total_debt !== void 0 ? `欠款: $${item.total_debt}` : `庫存: ${item.stock}`;
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
            aspectMode: "cover"
          }],
          width: "45px",
          height: "45px",
          cornerRadius: "4px"
        },
        {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: mainTitle, weight: "bold", size: "sm" },
            { type: "text", text: subTitle, size: "xs", color: "#888888" }
          ],
          margin: "md"
        }
      ],
      action: {
        type: "postback",
        data: `action=${actionType}&id=${item.id}&name=${mainTitle}`,
        displayText: `選取 ${mainTitle}`
      }
    };
  });
  const bodyContents = rows.flatMap((r, i) => i === 0 ? [r] : [{ type: "separator" }, r]).slice(0, 25);
  const flex = {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: title, weight: "bold", size: "lg", color: "#1DB446" }]
      },
      body: { type: "box", layout: "vertical", spacing: "sm", contents: bodyContents }
    }
  };
  return reply(env, "manager", replyToken, [flex]);
}

// 結帳推播給店長 (現金 / 賒帳)
export async function notifyManagerOfCheckout(env, { managerLineId, type, total, photoUrl, txId, cart }) {
  const isCredit = type === "credit";
  const itemsBlock = formatItemsBlock(cart);
  let text = `🔔 結帳通知（${isCredit ? "賒帳" : "現金"}）\n金額：$${total}\n\n購買商品：\n${itemsBlock}`;
  if (isCredit) text += "\n\n請點選對應族人 ↓";
  const quickReply = isCredit ? await buildDebtorQuickReply(env, txId) : null;
  const messages = [
    { type: "image", originalContentUrl: photoUrl, previewImageUrl: photoUrl },
    { type: "text", text, ...quickReply ? { quickReply } : {} }
  ];
  return push(env, "manager", managerLineId, messages);
}

// 寄賣商品審核卡片 (Flex Message)
export async function notifyManagerReview(env, { managerLineId, product, coverPhotoUrl, consignorNickname }) {
  const p = product;
  const bubble = {
    type: "bubble",
    ...coverPhotoUrl ? {
      hero: {
        type: "image",
        url: coverPhotoUrl,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "cover"
      }
    } : {},
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: "🆕 新寄賣商品待審", weight: "bold", color: "#1DB446", size: "sm" },
        { type: "text", text: p.name, weight: "bold", size: "xl", wrap: true },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            kv("寄賣者", consignorNickname || p.consignor_line_id || "—"),
            kv("售價", `$${p.price}`),
            kv("分類", p.category || "—"),
            kv("初始庫存", `${p.stock}`)
          ]
        }
      ]
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "secondary",
          height: "sm",
          action: { type: "postback", label: "駁回", data: `action=reject_product&product_id=${p.id}`, displayText: "駁回" }
        },
        {
          type: "button",
          style: "primary",
          color: "#1DB446",
          height: "sm",
          action: { type: "postback", label: "同意上架", data: `action=approve_product&product_id=${p.id}`, displayText: "同意上架" }
        }
      ]
    }
  };
  return push(env, "manager", managerLineId, [{ type: "flex", altText: `新寄賣商品待審：${p.name}`, contents: bubble }]);
}

// ⭐️ AI 學習完成/失敗推播給店長
export async function notifyManagerEmbeddingComplete(env, { productId, success, error }) {
  const product = await getProductById(env, productId);
  if (!product) return;

  const text = success
    ? `🎉【商品 AI 學習完成】\n商品名稱：「${product.name}」\n現場鏡頭已成功建立 120 組特徵模型！現在即可在收銀機前放上商品進行視覺結帳囉！✨`
    : `⚠️【商品 AI 學習失敗】\n商品名稱：「${product.name}」\n特徵生成失敗（${error || "未知原因"}），請檢查照片或重新拍攝。`;

  const managers = await listManagers(env);
  for (const m of managers) {
    try {
      await push(env, "manager", m.line_id, [{ type: "text", text }]);
    } catch (err) {
      console.error(`[manager-notify] push failed for manager ${m.line_id}:`, err);
    }
  }
}

// ============================================================
// 2. 店長事件處理核心 (Router)
// ============================================================

export async function handleManagerEvent(env, event, user, userId) {
  const channel = "manager";

  // 1. 關注事件 (Follow)
  if (event.type === "follow") {
    return new Response("OK");
  }

  // 2. Postback 事件
  if (event.type === "postback") {
    return handleManagerPostback(env, event, user, userId, channel);
  }

  // 3. 文字訊息事件 (Text)
  if (event.type === "message" && event.message.type === "text") {
    return handleManagerText(env, event, user, userId, user.last_command, channel);
  }

  // 4. 圖片訊息事件 (Image)
  if (event.type === "message" && event.message.type === "image") {
    return handleManagerImage(env, event, user, userId, channel);
  }

  return new Response("OK");
}

// ============================================================
// 3. 店長 Postback 處理
// ============================================================
async function handleManagerPostback(env, event, user, userId, channel) {
  if (!isManager(user)) return await replyManagerOnly(env, channel, event);

  const data = event.postback.data;
  const params = new URLSearchParams(data);
  const action = params.get("action");

  // 確認賒帳族人身份
  if (action === "confirm_debtor") {
    const txId = params.get("tx_id");
    const name = params.get("name");
    const tx = await getTransactionById(env, txId);
    const member = await getMemberByNickname(env, name);
    if (tx && member) {
      await addDebtForTransaction(env, { memberId: member.id, txId, amount: tx.total });
      await setTransactionIdentity(env, txId, name);
      return await replyText(env, channel, event.replyToken, `✅ 帳務更新成功！\n族人：${name}\n金額：$${tx.total}`);
    }
    return new Response("OK");
  }

  // 庫存補貨清單選單
  if (data === "action=inventory") {
    const list = await listProducts(env);
    return await sendPicker(env, event.replyToken, "📦 選擇補貨商品", list, "select_stock_item");
  }

  // 選中補貨商品
  if (action === "select_stock_item") {
    await setState(env, userId, "WAITING_STOCK_QTY", {
      id: params.get("id"),
      name: params.get("name")
    });
    return await replyText(env, channel, event.replyToken, `📝 已選：${params.get("name")}\n請輸入要「增加」的庫存數量：`);
  }

  // 族人除帳選單
  if (data === "action=debt_menu") {
    const list = await listMembers(env);
    return await sendPicker(env, event.replyToken, "💸 選擇除帳族人", list, "select_member_repay");
  }

  // 選中除帳族人
  if (action === "select_member_repay") {
    await setState(env, userId, "WAITING_DEBT_INFO", {
      id: params.get("id"),
      name: params.get("name")
    });
    return await replyText(env, channel, event.replyToken, `💸 已選：${params.get("name")}\n請輸入族人「還款」的金額：`);
  }

  // 新增商品
  if (data === "action=new_product_menu") {
    await setState(env, userId, "WAITING_PRODUCT_INFO");
    return await replyText(
      env,
      channel,
      event.replyToken,
      "📝 請輸入新商品資訊：\n[名稱] [價格] [分類] [庫存]\n\n分類：零食、玩具、日用品、特色商品、調味料、泡麵"
    );
  }

  // 發布公告
  if (data === "action=bulletin" || data === "bulletin") {
    await setState(env, userId, "WAITING_BULLETIN");
    return await replyText(env, channel, event.replyToken, "📢 請直接輸入布告欄公告內容：");
  }

  // 審核同意寄賣商品上架
  if (action === "approve_product") {
    const productId = params.get("product_id");
    const product = await getProductById(env, productId);
    if (!product) return await replyText(env, channel, event.replyToken, "❌ 找不到商品。");
    if (product.approval_status !== "pending") {
      return await replyText(env, channel, event.replyToken, `此商品已被處理（目前狀態：${APPROVAL_LABEL[product.approval_status] || product.approval_status}）。`);
    }
    try {
      const trainingRows = await query(env, `/rest/v1/training_data?product_id=eq.${productId}&select=image1,image2,image3,image4,image5,image6`);
      const trainingRow = Array.isArray(trainingRows) ? trainingRows[0] : null;
      if (!trainingRow || ![1, 2, 3, 4, 5, 6].every((n) => trainingRow[`image${n}`])) {
        return await replyText(env, channel, event.replyToken, "❌ 尚未收齊六張照片，無法核准。");
      }
      await enqueueEmbeddingJob(env, productId);
      await approveProduct(env, productId);
    } catch (err) {
      console.error("[approval] failed:", err);
      return await replyText(env, channel, event.replyToken, `❌ 核准失敗：${err.message}`);
    }
    return await replyText(env, channel, event.replyToken, `✅ 已同意上架：${product.name}\n⏳ 已自動派工給現場樹莓派進行 AI 視覺特徵訓練！`);
  }

  // 審核駁回寄賣商品
  if (action === "reject_product") {
    const productId = params.get("product_id");
    const product = await getProductById(env, productId);
    if (!product) return await replyText(env, channel, event.replyToken, "❌ 找不到商品。");
    if (product.approval_status !== "pending") {
      return await replyText(env, channel, event.replyToken, `此商品已被處理（目前狀態：${APPROVAL_LABEL[product.approval_status] || product.approval_status}）。`);
    }
    await setState(env, userId, "WAITING_REJECT_REASON", { productId });
    return await replyText(env, channel, event.replyToken, "📝 請輸入駁回原因（會寫入 DB 並通知寄賣者）：");
  }

  return new Response("OK");
}

// ============================================================
// 4. 店長文字指令處理
// ============================================================
async function handleManagerText(env, event, user, userId, currentState, channel) {
  if (!isManager(user)) return await replyManagerOnly(env, channel, event);

  const userMsg = (event.message.text || "").trim();
  const p = userMsg.split(/\s+/);

  // 1. 新增商品資訊輸入 [名稱] [價格] [分類] [庫存]
  if (currentState === "WAITING_PRODUCT_INFO") {
    if (p.length < 4 || !PRODUCT_CATEGORIES.includes(p[2])) {
      return await replyText(env, channel, event.replyToken, "❌ 格式錯誤。請輸入：[名稱] [價格] [分類] [庫存]\n例如：手工餅乾 50 零食 20");
    }
    const product = await createProduct(env, { name: p[0], price: p[1], category: p[2], stock: p[3] });
    await setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId: product.id, photoCount: 0 });
    return await replyText(env, channel, event.replyToken, `✅【${p[0]}】建立成功！\n\n請先上傳商品的「正面照」1 張 📸`);
  }

  // 2. 補貨數量輸入
  if (currentState === "WAITING_STOCK_QTY") {
    const qty = parseInt(userMsg);
    if (isNaN(qty)) return await replyText(env, channel, event.replyToken, "❌ 請輸入數字。");
    const { id, name } = user.temp_data || {};
    const newStock = await adjustStock(env, id, qty);
    await recordRestock(env, id, qty);
    await resetState(env, userId);
    return await replyText(env, channel, event.replyToken, `📦 ${name} 更新成功！目前庫存：${newStock}`);
  }

  // 3. 還款金額輸入
  if (currentState === "WAITING_DEBT_INFO") {
    const qty = parseInt(userMsg);
    if (isNaN(qty) || qty <= 0) return await replyText(env, channel, event.replyToken, "❌ 請輸入正確金額。");
    const { id, name } = user.temp_data || {};
    const newTotalDebt = await repayDebt(env, id, qty);
    await resetState(env, userId);
    return await replyText(env, channel, event.replyToken, `💸【除帳成功】\n族人：${name}\n目前總欠款：$${newTotalDebt}`);
  }

  // 4. 布告欄公告輸入
  if (currentState === "WAITING_BULLETIN") {
    await createAnnouncement(env, { description: userMsg });
    await resetState(env, userId);
    return await replyText(env, channel, event.replyToken, "✅ 公告發布成功！現場平板已同步更新。");
  }

  // 5. 駁回原因輸入
  if (currentState === "WAITING_REJECT_REASON") {
    const { productId } = user.temp_data || {};
    if (!productId) {
      await resetState(env, userId);
      return await replyText(env, channel, event.replyToken, "找不到要駁回的商品，動作取消。");
    }
    await rejectProduct(env, productId, userMsg);
    await resetState(env, userId);
    return await replyText(env, channel, event.replyToken, `✅ 已駁回商品，原因：${userMsg}`);
  }

  // 6. 查詢欠款：查詢 [族人名稱]
  if (userMsg.startsWith("查詢")) {
    const m = await getMemberByNickname(env, p[1]);
    if (m) {
      return await replyText(env, channel, event.replyToken, `👤 ${p[1]} 欠款：$${m.total_debt}`);
    }
    return await replyText(env, channel, event.replyToken, `找不到族人「${p[1]}」`);
  }

  // 7. ⭐️ 主動查詢商品學習進度：學習進度 [商品名稱] 或 進度 [商品名稱]
  if (userMsg.startsWith("學習進度") || userMsg.startsWith("進度")) {
    const keyword = userMsg.replace(/^(學習進度|進度)\s*/, "").trim();
    const products = await query(env, `/rest/v1/products?name=ilike.*${encodeURIComponent(keyword)}*&select=id,name,trained,approval_status`);
    if (!products || products.length === 0) {
      return await replyText(env, channel, event.replyToken, `找不到與「${keyword}」相關的商品`);
    }
    const prod = products[0];
    const jobs = await query(env, `/rest/v1/embedding_jobs?product_id=eq.${prod.id}&order=id.desc&limit=1`);
    const job = jobs?.[0];

    let statusText = "未知";
    if (prod.trained) statusText = "🟢 已完成學習（現場鏡頭可直接辨識結帳）";
    else if (job?.status === "processing") statusText = "🟡 AI 正在學習中（120 組特徵運算中）";
    else if (job?.status === "pending") statusText = "⏳ 排隊等待樹莓派處理中";
    else if (job?.status === "failed") statusText = `❌ 學習失敗：${job.last_error || "請重拍照片"}`;
    else if (prod.approval_status === "pending") statusText = "📋 等待店長審核中";

    return await replyText(env, channel, event.replyToken, `📦 商品：${prod.name}\n📊 AI 辨識狀態：${statusText}`);
  }

  return new Response("OK");
}

// ============================================================
// 5. 店長圖片訊息處理 (商品拍照上架 & 自動啟動 AI 學習)
// ============================================================
async function handleManagerImage(env, event, user, userId, channel) {
  if (user.last_command !== "WAITING_PRODUCT_PHOTOS") {
    return new Response("OK");
  }
  const { productId, photoCount = 0 } = user.temp_data || {};
  if (!productId) {
    return new Response("OK");
  }

  let trainData;
  try {
    trainData = await getOrCreateForProduct(env, productId);
  } catch (err) {
    console.error(`[image] getOrCreateForProduct throw:`, err);
    return await replyText(env, channel, event.replyToken, `❌ 讀取訓練資料失敗：${err?.message || "unknown"}`);
  }

  const field = nextEmptyImageField(trainData);
  if (!field) {
    console.warn(`[image] 6 個照片槽位已滿`);
    return new Response("OK");
  }

  let url;
  try {
    url = await attachImage(env, channel, {
      messageId: event.message.id,
      productId,
      trainDataId: trainData.id,
      field
    });
  } catch (err) {
    console.error(`[image] attachImage error:`, err);
    return await replyText(env, channel, event.replyToken, `❌ 存照片失敗：${err?.message || "unknown"}`);
  }

  const product = await getProductById(env, productId);
  if (product && (!product.image_url || field === "image1")) {
    await setImageUrl(env, productId, url);
  }

  const productName = product?.name || "";
  let replyMsg;
  if (field === "image1") {
    replyMsg = `✅ 已收到「${productName}」的正面照\n\n接下來請上傳側面照 5 張 📸`;
  } else if (field === "image2") {
    replyMsg = `📸 已收到側面照（1/5）`;
  } else if (field === "image3") {
    replyMsg = `📸 已收到側面照（2/5）`;
  } else if (field === "image4") {
    replyMsg = `📸 已收到側面照（3/5）`;
  } else if (field === "image5") {
    replyMsg = `📸 已收到側面照（4/5）`;
  } else {
    // ⭐️ 第 6 張（第 5 張側面照）收齊
    replyMsg = `✅【${productName}】6 張照片全數收齊！
🤖 現場 AI 特徵學習已自動啟動！樹莓派正進行 120 組旋轉擴增特徵訓練，約 1~2 分鐘完成後會在此推播通知您！✨`;
  }

  const isFinal = field === "image6";
  if (isFinal) {
    // ⭐️ 關鍵：第一時間先回覆店長，杜絕 replyToken 過期問題
    try {
      await replyText(env, channel, event.replyToken, replyMsg);
    } catch (replyErr) {
      console.error("[image] replyText failed:", replyErr);
    }

    // ⭐️ 安全排入 embedding 任務與重設狀態，不影響回覆
    try {
      await enqueueEmbeddingJob(env, productId);
      await resetState(env, userId);
    } catch (bgErr) {
      console.error("[image] background enqueue error:", bgErr);
    }
    return new Response("OK");
  }

  // 尚未收齊，累加計數並回覆
  await setState(env, userId, "WAITING_PRODUCT_PHOTOS", { productId, photoCount: photoCount + 1 });
  return await replyText(env, channel, event.replyToken, replyMsg);
}
