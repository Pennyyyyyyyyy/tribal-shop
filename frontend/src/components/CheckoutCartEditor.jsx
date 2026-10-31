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
    <div className="p-6 max-w-3xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-4 gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            🛒 辨識結果確認（共偵測到 {totalDetectedCount} 件物品）
          </h2>
          {unrecognizedCount > 0 && (
            <p className="text-sm text-amber-600 mt-1">
              ⚠️ 有 {unrecognizedCount} 件物品未認出，請調整擺放角度後重拍，或直接於下方加減數量。
            </p>
          )}
        </div>
        <button
          onClick={onRescan}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition cursor-pointer select-none"
        >
          🔄 重新拍照
        </button>
      </div>

      {/* 商品清單與 [+] [-] 數量調整器 */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-lg">
          目前清單沒有商品，請放置商品後點擊「重新拍照」
        </div>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
          {items.map((item) => (
            <div
              key={item.product_id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200"
            >
              <div className="flex items-center gap-4 min-w-0">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg border bg-white shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg border bg-white flex items-center justify-center text-3xl shrink-0">
                    🛍️
                  </div>
                )}
                <div className="truncate">
                  <h3 className="text-xl font-semibold text-gray-900 truncate">{item.name}</h3>
                  <p className="text-gray-500">單價 NT$ {item.price}</p>
                </div>
              </div>

              {/* 觸控友善的大尺寸 [-] 數量 [+] 控制區 */}
              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product_id, -1)}
                    className="w-12 h-12 rounded-xl bg-red-100 active:bg-red-200 text-red-600 text-2xl font-bold flex items-center justify-center select-none shadow-sm hover:scale-105 active:scale-95 transition cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-2xl font-bold text-gray-800">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product_id, 1)}
                    className="w-12 h-12 rounded-xl bg-green-100 active:bg-green-200 text-green-700 text-2xl font-bold flex items-center justify-center select-none shadow-sm hover:scale-105 active:scale-95 transition cursor-pointer"
                  >
                    ＋
                  </button>
                </div>

                <div className="w-24 sm:w-28 text-right font-bold text-xl text-gray-900">
                  NT$ {item.price * item.quantity}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部總計與進入投幣結帳按鈕 */}
      <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-gray-600 text-lg">共 {totalCount} 件商品，總計：</span>
          <span className="text-3xl font-extrabold text-emerald-600 ml-2">
            NT$ {totalAmount}
          </span>
        </div>

        <button
          disabled={items.length === 0}
          onClick={() => onProceedToPay(items, totalAmount)}
          className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 text-white text-xl font-bold rounded-xl shadow-md active:scale-95 transition cursor-pointer"
        >
          確認數量，開始投幣結帳 ➔
        </button>
      </div>
    </div>
  );
}

export default CheckoutCartEditor;
