import type { Config } from "tailwindcss";

// Design system inspired by the reference video: warm cream surfaces alternating with
// white, a kelly-green accent, chunky rounded display type, pill controls and
// large soft cards. `slate` is remapped to a warm stone scale so every existing
// utility (text-slate-500, border-slate-200, …) picks up the new look.
const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: "#f6f1e7", deep: "#ece4d3" },
        ink: "#16231c",
        brand: {
          50: "#eaf7ee",
          100: "#d0eddb",
          200: "#a3dbb9",
          300: "#6ec392",
          400: "#3aa86b",
          500: "#1f9254",
          600: "#17803f",
          700: "#136734",
          800: "#11522c",
          900: "#0d4024",
        },
        slate: {
          50: "#faf7f1",
          100: "#f3eee3",
          200: "#e6dfce",
          300: "#d3cab4",
          400: "#a39b86",
          500: "#7b7463",
          600: "#5e584a",
          700: "#463f35",
          800: "#2d2923",
          900: "#16231c",
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Fredoka Variable"', "Fredoka", '"Inter Variable"', "ui-rounded", "system-ui", "sans-serif"],
      },
      borderRadius: { "4xl": "2rem" },
      boxShadow: {
        soft: "0 1px 0 rgba(22,35,28,0.04), 0 8px 24px -12px rgba(22,35,28,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
