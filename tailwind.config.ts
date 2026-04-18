import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        racing: {
          black: "#0a0a0a",
          dark: "#141414",
          red: "#e60012",
          "red-dark": "#b8000e",
          "red-light": "#ff1a2e",
          white: "#f5f5f5",
          silver: "#c0c0c0",
          gold: "#d4af37",
          "chequered-dark": "#1a1a1a",
          "chequered-light": "#2a2a2a",
        },
        surface: {
          950: "#050505",
          900: "#0a0a0a",
          800: "#111111",
          700: "#1a1a1a",
          600: "#242424",
          500: "#2e2e2e",
          400: "#3a3a3a",
          300: "#4a4a4a",
        },
        text: {
          primary: "#ffffff",
          secondary: "#b0b0b0",
          muted: "#6b6b6b",
        },
        // Keep brand aliases for existing components
        brand: {
          red: "#e60012",
          "red-dark": "#b8000e",
          "red-light": "#ff1a2e",
          yellow: "#d4af37",
          "yellow-dark": "#b8960f",
          orange: "#ff6600",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        digital: ["var(--font-digital)", "monospace"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(230, 0, 18, 0.3)" },
          "50%": { boxShadow: "0 0 50px rgba(230, 0, 18, 0.6)" },
        },
        "pulse-text": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "sweep-right": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(100%)" },
        },
        "scroll-left": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "scroll-right": {
          from: { transform: "translateX(-50%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "fade-in-up": "fade-in-up 0.6s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "pulse-text": "pulse-text 2s ease-in-out infinite",
        "sweep-right": "sweep-right 0.4s ease-out",
        "scroll-left": "scroll-left 30s linear infinite",
        "scroll-right": "scroll-right 30s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
