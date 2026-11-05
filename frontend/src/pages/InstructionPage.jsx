import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "../components/BackButton";
import CameraIcon from "../components/CameraIcon";

const AUTO_START_MS = 3000;

export default function InstructionPage() {
  const navigate = useNavigate();

  // 3 秒後自動進入掃描；也可以按「立即開始」
  useEffect(() => {
    const timer = setTimeout(() => navigate("/scan"), AUTO_START_MS);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[420px_minmax(0,1fr)] gap-14 px-8 py-8 items-center">
      <div className="flex flex-col gap-6">
        <BackButton to="/" />
        <h1 className="font-display text-[52px] leading-[1.2]">
          請將商品
          <br />
          放到鏡頭前
        </h1>
        <p className="text-[22px] leading-[1.65]">
          依照螢幕上的指示擺放，辨識完成前請不要離開。
        </p>

        <div className="panel px-6 py-[22px] flex flex-col gap-3.5">
          <div className="text-lg font-bold">鏡頭啟動中，約 3 秒</div>
          <div className="h-3.5 rounded-full bg-sand overflow-hidden">
            <div
              className="h-full bg-clay rounded-full motion-safe:animate-[fill-bar_3s_linear_forwards] motion-reduce:w-full"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/scan")}
          className="btn-press focus-ring self-start h-[72px] px-10 bg-forest text-paper text-[26px]"
        >
          立即開始
        </button>
      </div>

      <div className="relative aspect-[16/10] bg-cocoa border-[3px] border-ink rounded-[28px] shadow-press-lg overflow-hidden flex items-center justify-center">
        <div className="absolute top-[18px] right-[18px] flex items-center gap-2 bg-paper/10 text-paper rounded-full px-4 py-2 text-sm font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-peach" />
          準備中
        </div>
        <div className="text-center text-cream flex flex-col items-center gap-3.5">
          <CameraIcon size={64} strokeWidth={1.6} />
          <div className="font-display text-[26px]">正在準備鏡頭與辨識系統</div>
        </div>
      </div>
    </div>
  );
}
