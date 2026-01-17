

// src/components/steps/StepInstruction.jsx
import React from 'react';
import CameraView from '../CameraView';

function StepInstruction() {
  return (
    <div className="flex flex-col md:flex-row gap-8 w-full h-full">
      <div className="flex-1 flex flex-col justify-center space-y-6">
        <h2 className="text-3xl font-bold text-slate-800">請將物品拿到鏡頭前</h2>
        <p className="text-xl text-slate-600">
          依照螢幕上的指示動作，在尚未辨識完成前請勿離開。
        </p>
        <p className="text-lg text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          系統將自動啟動鏡頭並嘗試辨識您的商品，約需 3 秒鐘，請稍候。
        </p>
        <p className="text-sm text-slate-400">
          （目前僅顯示實際相機畫面，辨識流程仍使用模擬資料）
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <CameraView label="CAMERA 01 · FRONT" status="LIVE" />
      </div>
    </div>
  );
}

export default StepInstruction;



//模擬畫面
// function StepInstruction() {
//   return (
//     <div className="flex flex-col md:flex-row gap-8 w-full h-full">
//       <div className="flex-1 flex flex-col justify-center space-y-6">
//         <h2 className="text-3xl font-bold text-slate-800">請將物品拿到鏡頭前</h2>
//         <p className="text-xl text-slate-600">
//           依照螢幕上的指示動作，在尚未辨識完成前請勿離開。
//         </p>
//         <p className="text-lg text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
//           系統將自動啟動鏡頭並嘗試辨識您的商品，約需 3 秒鐘，請稍候。
//         </p>
//         <p className="text-sm text-slate-400">
//           （此為模擬畫面，實作時可接入實際影像辨識與後端 API）
//         </p>
//       </div>
//       <div className="flex-1 flex items-center justify-center">
//         <div className="relative w-full max-w-xl aspect-video bg-black rounded-3xl shadow-2xl overflow-hidden border-4 border-slate-800">
//           <div className="absolute top-4 left-4 text-xs font-mono text-green-300 bg-black/60 px-3 py-1 rounded-full">
//             CAMERA 01 · FRONT
//           </div>
//           <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full">
//             <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
//             <span className="text-xs text-white tracking-widest font-semibold">
//               LIVE
//             </span>
//           </div>
//           <div className="w-full h-full flex items-center justify-center">
//             <div className="text-center text-slate-100">
//               <div className="text-6xl mb-4">📷</div>
//               <div className="text-xl">正在準備鏡頭與辨識系統...</div>
//               <div className="mt-2 text-sm text-slate-300">約 3 秒後進入「辨識中」畫面</div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default StepInstruction;

