import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-noto-sans-tc)", "sans-serif"],
        display: ["var(--font-cormorant)", "serif"],
      },
      colors: {
        bg: "#FAF7EF",
        card: "#FFFFFF",
        navy: "#0F2A4A",
        "navy-soft": "#1E3A5F",
        "navy-dark": "#0A1E36",
        gold: "#C2992F",
        "gold-soft": "#E8D9A8",
        muted: "#6B7B8E",
        line: "#E5DFCF",
        text: "#1F2937",
      },
    },
  },
  plugins: [],
};
export default config;
