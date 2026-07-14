/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/home/index.html"],
  theme: {
    extend: {
      colors: {
        bluebrand: "#0a8f51",
        blueglow: "#91e9bb",
        deepblue: "#63d99a",
        ink: "#07111f",
        muted: "#5d6b7c",
        doripe: "#22ff88",
        cream: "#f8fffb",
      },
      fontFamily: {
        fustat: ["Fustat", "Pretendard Variable", "Pretendard", "Inter", "system-ui", "sans-serif"],
        pretendard: ["Pretendard Variable", "Pretendard", "Inter", "system-ui", "sans-serif"],
        inter: ["Pretendard Variable", "Pretendard", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
