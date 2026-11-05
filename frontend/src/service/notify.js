// 請 Worker 用 LINE 通知店長（POS 現場事件）。
// event 只能是 coin_complete / device_error / payment_timeout，訊息文字在 Worker 的 POS_NOTIFY_MESSAGES。
// 通知失敗不影響客人結帳，只記在 console。
const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL || "https://flying-squirrel-shop-staging.autocheckout2025.workers.dev").replace(/\/+$/, "");

export function notifyManager(event) {
  return fetch(`${WORKER_URL}/pos/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true, // 換頁中也把請求送完
  })
    .then((res) => {
      if (!res.ok) console.warn(`[notify] ${event} 回應 ${res.status}`);
    })
    .catch((err) => console.warn(`[notify] ${event} 送出失敗`, err));
}
