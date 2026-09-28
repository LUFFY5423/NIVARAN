import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f4",
          100: "#d7ece3",
          200: "#b0d9c7",
          300: "#82c1a7",
          400: "#57a687",
          500: "#38876c",
          600: "#296c57",
          700: "#215747",
          800: "#1c453a",
          900: "#193931",
        },
        saffron: {
          50: "#fff8ec",
          100: "#feecc9",
          200: "#fdd68e",
          300: "#fbb84f",
          400: "#f89c24",
          500: "#ef7f0f",
          600: "#d3600b",
          700: "#af450c",
          800: "#8e3610",
          900: "#752e10",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
