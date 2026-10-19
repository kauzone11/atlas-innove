import type { Config } from "tailwindcss";

// Theme colors resolve through CSS variables so light and dark share utilities; alpha modifiers use color-mix.
type ColorFn = (options: { opacityValue?: string }) => string;
const token = (name: string): string => {
  const resolve: ColorFn = ({ opacityValue }) =>
    opacityValue === undefined || opacityValue === "1" || Number.isNaN(Number(opacityValue)) ? `var(${name})` : `color-mix(in srgb, var(${name}) ${Number(opacityValue) * 100}%, transparent)`;
  return resolve as unknown as string;
};

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: token("--ink"),
        slate: token("--muted"),
        canvas: token("--bg"),
        surface: token("--surface"),
        "surface-subtle": token("--bg-sub"),
        line: token("--line"),
        "line-strong": token("--line-2"),
        accent: token("--action"),
        "accent-hover": token("--action-hover"),
        "accent-soft": token("--brand-soft"),
        focus: token("--focus"),
        success: token("--ok"),
        warning: token("--warn"),
        danger: token("--bad"),
        "danger-soft": token("--bad-soft"),
        "success-soft": token("--ok-soft"),
        "warning-soft": token("--warn-soft"),
        white: token("--surface"),
      },
      fontFamily: { sans: ["var(--f-body)"], mono: ["var(--f-mono)"] },
      borderRadius: { md: "12px", lg: "14px", xl: "20px", "2xl": "24px" },
      boxShadow: {
        panel: "var(--shadow-card)",
        floating: "var(--shadow-pop)",
      },
    },
  },
  plugins: [],
};

export default config;
