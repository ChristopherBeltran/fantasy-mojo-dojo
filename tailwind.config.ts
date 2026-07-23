import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: "#05070d",
        sidebar: "#0a0e17",
        card: "#0d1420",
        cardHover: "#131b2c",
        border: "#1e2937",
        muted: "#7c8798",
        faint: "#4b5563",
        brandGreen: "#22c55e",
        brandIndigo: "#6366f1",
        brandGold: "#d4a656",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};

export default config;
