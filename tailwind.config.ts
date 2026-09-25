import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1c1a",
        slate: "#6d6d68",
        canvas: "#f7f7f4",
        surface: "#ffffff",
        "surface-subtle": "#f3f3ef",
        line: "#e5e5df",
        "line-strong": "#c7c7c0",
        accent: "#f5662d",
        "accent-hover": "#d94d1b",
        "accent-soft": "#fff0e9",
        focus: "#f3a17e",
        success: "#167447",
        warning: "#9a5d0a",
        danger: "#b3261e",
        "danger-soft": "#fff0ee",
        "success-soft": "#edf8f2",
        "warning-soft": "#fff7e8",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(28, 28, 26, 0.03), 0 8px 24px rgba(28, 28, 26, 0.035)",
        floating: "0 18px 48px rgba(28, 28, 26, 0.16)",
      },
    },
  },
  plugins: [],
};

export default config;
