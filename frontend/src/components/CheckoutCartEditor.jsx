import React, { useState, useMemo } from "react";

export function CheckoutCartEditor({
  initialItems = [],
  totalDetectedCount = 0,
  unrecognizedCount = 0,
  onRescan,
  onProceedToPay,
}) {
  const [items, setItems] = useState(initialItems);

  // 點擊 [+] 或 [-] 調整數量 (減到 0 時自動移除該商品)
  const updateQuantity = (productId, delta) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // 計算總件數與應付總金額
  const { totalCount, totalAmount } = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        totalCount: acc.totalCount + item.quantity,
        totalAmount: acc.totalAmount + item.price * item.quantity,
      }),
      { totalCount: 0, totalAmount: 0 }
    );
  }, [items]);

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col gap-3">
      {/* 頂部操作/狀態列 */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-slate-800">
            辨識結果確認
          </span>
          {totalDetectedCount !== undefined && (
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              偵測到 {totalDetectedCount} 件物品
            </span>
          )}
          {unrecognizedCount > 0 && (
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
              ⚠️ {unrecognizedCount} 件未辨識
            </span>
          )}
        </div>
        {onRescan && (
          <button
            onClick={onRescan}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition cursor-pointer select-none"
          >
            📷 重新拍照
          </button>
        )}
      </div>

      {/* 商品卡片區 - 與 ProductSelectPage.jsx 完全一致的風格 */}
      <div
        className="flex-1 overflow-y-scroll pr-3 min-h-0
          [&::-webkit-scrollbar]:w-2
          [&::-webkit-scrollbar-track]:bg-slate-100
          [&::-webkit-scrollbar-track]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-slate-400
          [&::-webkit-scrollbar-thumb]:rounded-full
          hover:[&::-webkit-scrollbar-thumb]:bg-slate-500"
      >
        {items.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-3">
            <span className="text-5xl">🛒</span>
            <p className="text-base font-medium">目前清單沒有商品</p>
            {onRescan && (
              <button
                onClick={onRescan}
                className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 shadow-md transition"
              >
                📷 重新拍照
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {items.map((item) => (
              <div
                key={item.product_id}
                data-testid={`cart-card-${item.name}`}
                className="w-44 flex-none bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
              >
                <div className="w-full h-44 bg-slate-50 flex items-center justify-center p-3 shrink-0">
                  {item.image_url ? (
                    <img
                      src={
                        item.image_url.startsWith("http")
                          ? item.image_url
                          : item.image_url.replace(
                              "/uploads/product_photos/",
                              "/photo/"
                            )
                      }
                      alt={item.name}
                      className="max-w-full max-h-full object-contain mx-auto"
                    />
                  ) : (
                    <span className="text-4xl">{item.image || "🛍️"}</span>
                  )}
                </div>

                <div className="p-3 flex flex-col gap-1.5">
                  <div
                    className="text-sm font-bold text-slate-800 truncate"
                    title={item.name}
                  >
                    {item.name}
                  </div>
                  <div className="text-base font-bold text-emerald-700">
                    ${item.price}
                  </div>

                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      type="button"
                      data-testid={`btn-dec-${item.name}`}
                      onClick={() => updateQuantity(item.product_id, -1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-base font-bold hover:bg-slate-200 active:scale-95 transition flex items-center justify-center cursor-pointer select-none"
                      aria-label="減少數量"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-base font-bold text-slate-800 select-none">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      data-testid={`btn-inc-${item.name}`}
                      onClick={() => updateQuantity(item.product_id, 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 text-base font-bold hover:bg-slate-200 active:scale-95 transition flex items-center justify-center cursor-pointer select-none"
                      aria-label="增加數量"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部總計與確認按鈕 */}
      {onProceedToPay && (
        <div className="mt-3 bg-white rounded-2xl border border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="text-slate-700">
            <span className="text-sm text-slate-500">購物車</span>
            <span className="text-xl font-bold ml-2">
              {totalCount} 項 · ${totalAmount}
            </span>
          </div>

          <button
            disabled={items.length === 0}
            onClick={() => onProceedToPay(items, totalAmount)}
            className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-base shadow-lg active:scale-95 transition cursor-pointer"
          >
            前往結帳 ➔
          </button>
        </div>
      )}
    </div>
  );
}

export default CheckoutCartEditor;
