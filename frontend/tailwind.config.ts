/**
 * Tailwind theme aligns with layout.tsx font variables and the dark “scholar” palette so
 * utility classes stay consistent across marketing and app surfaces.
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.2s ease-in-out infinite",
        "fade-in-up": "fadeInUp 0.45s ease-out forwards",
      },
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
