 // src/components/steps/StepEvidenceConfirm.jsx
import React from 'react';

function StepEvidenceConfirm({ evidenceSnapshot, onRedo, onSubmit }) {
  return (
    <div className="flex flex-col w-full h-full items-center justify-center gap-8">
      <h2 className="text-3xl font-bold text-slate-800">請確認存證畫面</h2>
      <p className="text-lg text-slate-600 text-center max-w-xl">
        以下為剛才錄製的畫面截圖，用於日後對帳與存證。若您不滿意，可以重新錄製一次。
      </p>
      <div className="w-full max-w-2xl">
        <div className="relative w-full aspect-video bg-black rounded-3xl shadow-2xl overflow-hidden border-4 border-slate-800">
          {evidenceSnapshot ? (
            <img
              src={evidenceSnapshot}
              alt="Evidence Snapshot"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-100">
              無截圖可顯示（Mock）
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl mt-4">
        <button
          onClick={onRedo}
          className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-800 text-lg font-semibold shadow-md hover:bg-slate-200"
        >
          🔁 重新錄製
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 px-6 py-4 rounded-2xl bg-green-600 text-white text-xl font-bold shadow-lg hover:bg-green-500 transition-transform hover:scale-105 active:scale-95"
        >
          📤 送出存證並完成
        </button>
      </div>
    </div>
  );
}

export default StepEvidenceConfirm;

