import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        slate: "#506070",
        canvas: "#f4f6f8",
        line: "#d9e0e7",
        accent: "#256d68",
        "accent-dark": "#19524e",
      },
      boxShadow: {
        panel: "0 10px 30px rgba(23, 33, 43, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
