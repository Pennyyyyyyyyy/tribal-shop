import { useEffect } from "react";

// 解決瀏覽器 (尤其是 Chrome) 語音播放到一半被垃圾回收 (Garbage Collection) 的 Bug
let globalUtterance = null;

export function useVoiceInstruction(text, dependencies = []) {
  useEffect(() => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    
    // 取消尚未播完的語音，避免重疊與卡死
    window.speechSynthesis.cancel();
    
    // 使用 setTimeout 確保 cancel() 完全執行後再加入新的語音，避免語音引擎佇列當機
    const timer = setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-TW";
      utterance.rate = 1.0;
      
      globalUtterance = utterance; // 保留全域參考
      
      window.speechSynthesis.speak(utterance);
    }, 50);
    
    return () => {
      clearTimeout(timer);
      window.speechSynthesis.cancel();
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
}