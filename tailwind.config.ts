import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#142235",
        slate: "#526174",
        canvas: "#f5f8fc",
        surface: "#ffffff",
        "surface-subtle": "#f8fafc",
        line: "#dfe6ef",
        "line-strong": "#b8c7d9",
        brand: "#1557c8",
        "brand-hover": "#0f46a8",
        "brand-soft": "#eaf2ff",
        focus: "#83b7ff",
        success: "#19704a",
        warning: "#9a5b08",
        danger: "#b42318",
        "danger-soft": "#fff0ee",
        "success-soft": "#edf8f2",
        "warning-soft": "#fff7e8",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(20, 34, 53, 0.04), 0 8px 24px rgba(20, 34, 53, 0.04)",
        floating: "0 16px 40px rgba(20, 34, 53, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
