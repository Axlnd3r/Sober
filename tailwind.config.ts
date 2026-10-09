import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      colors: {
        cinema: { bg: "#0A0B10", text: "#FFFFFF", muted: "#8A8D98", border: "rgba(255,255,255,.12)", positive: "#2ECC71", danger: "#E5383B", accent: "#4B3BFF", glow: "#D61F2C" },
      },
      fontFamily: { sans: ["Plus Jakarta Sans", "Arial", "sans-serif"] },
      transitionTimingFunction: { cinema: "cubic-bezier(.22,1,.36,1)" },
    },
  },
} satisfies Config;
