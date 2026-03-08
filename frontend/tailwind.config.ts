import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
        display: ["var(--font-orbitron)", "system-ui", "sans-serif"],
      },
      colors: {
        primary: "#020617",     // slate-950 (dark)
        secondary: "#a78bfa",   // violet-400 (light purple)
        accent: "#8b5cf6",      // violet-500 (buttons)
        "scholar-bg": "#020617",   // slate-950
        "scholar-text": "#f1f5f9", // slate-100
      },
    },
  },
  plugins: [],
};
export default config;
