import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        tedx: {
          DEFAULT: "#EB0028",
          red: "#EB0028",
          darkred: "#C20021",
          lightred: "#FF2B4F",
          black: "#0A0A0A",
          charcoal: "#141416",
          gray: "#1F1F23",
          border: "#2E2E33",
          muted: "#8E8E93",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        tedx: "0 0 25px -5px rgba(235, 0, 40, 0.25)",
        "tedx-lg": "0 0 50px -10px rgba(235, 0, 40, 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
