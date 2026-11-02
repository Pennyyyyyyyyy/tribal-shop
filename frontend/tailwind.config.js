/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Noto Sans TC'", "system-ui", "sans-serif"],
        // 標題、數字、按鈕用的圓體
        display: ["'Huninn'", "'Noto Sans TC'", "sans-serif"],
      },
      // Go-Remote 設計稿色票（design/Go-Remote 重新設計 v0.html）
      colors: {
        cream: "#F5EDC8", // 頁面底色
        paper: "#FFFBEF", // 卡片底色
        wheat: "#F2E6B8", // 表頭、次要底色
        sand: "#E3D6AA", // 次要按鈕、細框線
        ink: "#4A2C1A", // 主要文字、粗框線
        forest: "#2F5D47", // 頂欄、確認類按鈕
        clay: "#A8642E", // 主要行動按鈕
        rust: "#8A4F22", // 價格、警示數字
        peach: "#F6C9A3", // 提示框、進度條
        moss: "#B9C48F", // 成功、已完成
        cocoa: "#3A2414", // 相機畫面底色
      },
      boxShadow: {
        press: "0 5px 0 #4A2C1A",
        "press-sm": "0 4px 0 #4A2C1A",
        "press-lg": "0 6px 0 #4A2C1A",
      },
    },
  },
  plugins: [],
}
