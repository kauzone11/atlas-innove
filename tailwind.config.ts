import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1b1a18",
        slate: "#787369",
        faint: "#b8b0a1",
        canvas: "#fdfcf9",
        surface: "#ffffff",
        "surface-subtle": "#faf9f3",
        "surface-selected": "#f3f0e2",
        line: "#e8e3d6",
        "line-strong": "#d5cfc2",
        accent: "#ff520e",
        "accent-hover": "#e33d07",
        "accent-soft": "#ffecdf",
        "data-purple": "#594aba",
        "data-purple-soft": "#eeeaff",
        focus: "#b94a1f",
        success: "#0dbd5c",
        warning: "#a86b00",
        danger: "#ed2939",
        "danger-soft": "#fff0ee",
        "success-soft": "#e9f8ef",
        "warning-soft": "#fff5dc",
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
