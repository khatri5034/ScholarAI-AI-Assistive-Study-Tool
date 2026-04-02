/**
 * Tailwind theme aligns with layout.tsx font variables and the dark “scholar” palette so
 * utility classes stay consistent across marketing and app surfaces.
 */

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
        secondary: "#818cf8",   // indigo-400 (background purple/blue)
        accent: "#6366f1",      // indigo-500 (buttons)
        "scholar-bg": "#020617",   // slate-950
        "scholar-text": "#f1f5f9", // slate-100
      },
    },
  },
  plugins: [],
};
export default config;
