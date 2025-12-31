// src/components/steps/StepScanning.jsx
import React from 'react';
import CameraView from '../CameraView';

/**
 * A：掃描頁合併確認
 * - phase = SCANNING | AUTO_ADDED | CONFIRM
 * - pendingItem：低信心才會有，顯示同頁確認卡
 * - lastAddedItem：顯示「已加入」提示
 */
function StepScanning({
  phase = 'SCANNING',
  pendingItem = null,
  lastAddedItem = null,
  cartCount = 0,
  totalAmount = 0,
  onConfirmItem,
  onRejectItem,
  onGoCart,
}) {
  const title =
    phase === 'CONFIRM'
      ? '請確認商品'
      : phase === 'AUTO_ADDED'
      ? '已加入商品'
      : '辨識中...';

  const subtitle =
    phase === 'CONFIRM'
      ? '系統不太確定，請您看一下是否正確。'
      : phase === 'AUTO_ADDED'
      ? '請繼續放下一樣商品到鏡頭前。'
      : '請把商品放在鏡頭中央，等待辨識完成。';

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-col md:flex-row gap-8 w-full flex-1 min-h-0">
        {/* 左側文字（刻意縮短，長者較不排斥） */}
        <div className="flex-1 flex flex-col justify-center space-y-4">
          <h2 className="text-3xl font-bold text-slate-800">{title}</h2>
          <p className="text-xl text-slate-600">{subtitle}</p>

          {phase === 'CONFIRM' && pendingItem ? (
            <div className="text-slate-500 text-sm">
              提示：如果不是這個商品，按「不是，重掃」就好。
            </div>
          ) : null}
        </div>

        {/* 右側鏡頭 */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <CameraView label="SCANNING CAM" status={phase}>
            <div className="relative h-full w-full">
              {/* 辨識中 overlay */}
              {phase === 'SCANNING' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/60 text-slate-100 px-6 py-4 rounded-2xl text-center">
                    <div className="text-2xl mb-2">🔍 辨識中...</div>
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce" />
                      <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce [animation-delay:0.15s]" />
                      <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce [animation-delay:0.3s]" />
                    </div>
                    <div className="text-xs text-slate-300">（模擬）約 1 秒後顯示結果</div>
                  </div>
                </div>
              )}

              {/* 自動加入提示 */}
              {phase === 'AUTO_ADDED' && lastAddedItem && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-emerald-600/90 text-white px-6 py-5 rounded-2xl text-center shadow-xl">
                    <div className="text-3xl mb-2">✅ 已加入</div>
                    <div className="text-xl font-semibold">
                      {lastAddedItem.image} {lastAddedItem.name}　${lastAddedItem.price}
                    </div>
                    <div className="text-sm opacity-90 mt-1">請放下一樣商品到鏡頭前</div>
                  </div>
                </div>
              )}

              {/* 低信心：同頁確認卡 */}
              {phase === 'CONFIRM' && pendingItem && (
                <div className="absolute inset-0 flex items-end justify-center pb-6 px-4">
                  <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6">
                    <div className="flex items-center gap-4">
                      <div className="text-5xl">{pendingItem.image}</div>
                      <div className="flex-1">
                        <div className="text-xl font-bold text-slate-800">{pendingItem.name}</div>
                        <div className="text-slate-600 mt-1">金額：${pendingItem.price}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          信心度：{Math.round((pendingItem.confidence || 0) * 100)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                      <button
                        onClick={onConfirmItem}
                        className="w-full px-5 py-4 rounded-2xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-500 shadow-lg transition-transform hover:scale-105 active:scale-95"
                      >
                        ✅ 是，加入清單
                      </button>
                      <button
                        onClick={onRejectItem}
                        className="w-full px-5 py-4 rounded-2xl bg-slate-200 text-slate-800 font-semibold text-lg hover:bg-slate-300 shadow-md transition-transform hover:scale-105 active:scale-95"
                      >
                        ↩️ 不是，重掃
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CameraView>
        </div>
      </div>

      {/* 底部簡單摘要（先不做抽屜 B；A 先給一個「去清單」入口） */}
      <div className="mt-5 bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center justify-between">
        <div className="text-slate-700">
          <div className="text-sm text-slate-500">目前已加入</div>
          <div className="text-xl font-bold">
            {cartCount} 件　<span className="text-slate-400">/</span> ${totalAmount}
          </div>
        </div>
        <button
          onClick={onGoCart}
          className="px-6 py-4 rounded-2xl bg-sky-600 text-white font-bold text-lg hover:bg-sky-500 shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          🛒 查看清單
        </button>
      </div>
    </div>
  );
}

export default StepScanning;




/* // src/components/steps/StepScanning.jsx
import React from 'react';
import CameraView from '../CameraView';

function StepScanning() {
  return (
    <div className="flex flex-col md:flex-row gap-8 w-full h-full">
      <div className="flex-1 flex flex-col justify-center space-y-6">
        <h2 className="text-3xl font-bold text-slate-800">辨識中...</h2>
        <p className="text-xl text-slate-600">
          系統正在辨識您拿在鏡頭前的商品，請保持物品在畫面中央。
        </p>
        <ul className="list-disc list-inside text-slate-600 space-y-1">
          <li>請勿遮擋商品關鍵標籤或包裝。</li>
          <li>若有多樣商品，請一次放一樣即可。</li>
          <li>辨識完成後會顯示商品資訊供您確認是否正確。</li>
        </ul>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <CameraView label="SCANNING CAM" status="SCANNING">
          //{ 疊在鏡頭上的提示 UI }
          <div className="flex items-center justify-center h-full">
            <div className="bg-black/60 text-slate-100 px-6 py-4 rounded-2xl text-center">
              <div className="text-2xl mb-2">🔍 辨識中...</div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce" />
                <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce [animation-delay:0.15s]" />
                <span className="w-3 h-3 rounded-full bg-slate-200 animate-bounce [animation-delay:0.3s]" />
              </div>
              <div className="text-xs text-slate-300">約 2 秒後顯示辨識結果（模擬）</div>
            </div>
          </div>
        </CameraView>
      </div>
    </div>
  );
}

export default StepScanning;

*/