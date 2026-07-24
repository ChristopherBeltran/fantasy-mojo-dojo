import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: "#071312",
        sidebar: "#0a1918",
        card: "#0e211f",
        cardHover: "#142e2b",
        border: "#1f3d39",
        muted: "#7fa39d",
        faint: "#4a6b66",
        brandTeal: "#14b8a6",
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
