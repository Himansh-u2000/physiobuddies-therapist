/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#e9f6fe",
        surface: "#f5fffe",
        "surface-strong": "#ffffff",
        fg: "#021526",
        muted: "#5e6b77",
        border: "#cfd9df",
        accent: {
          DEFAULT: "#004060",
          light: "#004e71",
          dark: "#003d5e",
        },
        success: {
          DEFAULT: "#239149",
          light: "#349e54",
          dark: "#138840",
        },
        warning: "#d19a12",
        danger: "#cf4238",
        info: "#0086a8",
        tint: "#e8fbfa",
        nav: "#003554",
        "primary-soft": "#d7f2ff",
        "mint-soft": "#e0fbef",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "18px",
      },
      fontFamily: {
        display: ["System"],
        body: ["System"],
        mono: ["monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px" }],
      },
    },
  },
  plugins: [],
};
