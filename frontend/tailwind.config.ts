import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FAF8F3",
        charcoal: "#1C1C1C",
        forest: "#2D5016",
        "forest-light": "#4A7A28",
        "warm-gold": "#C9922A",
        sand: "#E8DCC8",
        surface: "#FFFFFF",
        muted: "#6B6B6B",
        "border-custom": "#E5E0D8",
        danger: "#C0392B",
        success: "#27AE60",
      },
      fontFamily: {
        playfair: ["Playfair Display", "serif"],
        dm: ["DM Sans", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "slide-right": "slideRight 0.5s ease-out",
        typing: "typing 1.4s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        typing: {
          "0%, 60%, 100%": { opacity: "0.3" },
          "30%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
