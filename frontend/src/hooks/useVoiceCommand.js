import { useEffect, useRef } from "react";

export function useVoiceCommand(commands) {
  const commandsRef = useRef(commands);
  const isMounted = useRef(true);

  // 使用 ref 保存最新的指令，避免閉包陷阱導致呼叫到舊的 state
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  useEffect(() => {
    isMounted.current = true;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn("⚠️ 此瀏覽器不支援 Web Speech API 語音辨識");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-TW"; // 設定辨識語言為繁體中文
    recognition.continuous = true; // 持續監聽模式

    recognition.onresult = (event) => {
      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript.trim();
      console.log("🎤 聽到語音指令:", transcript);

      // 比對設定好的關鍵字
      for (const [keyword, action] of Object.entries(commandsRef.current)) {
        if (transcript.includes(keyword)) {
          action();
        }
      }
    };

    recognition.start();

    return () => {
      isMounted.current = false;
      recognition.stop(); // 組件卸載時關閉麥克風
    };
  }, []);
}
