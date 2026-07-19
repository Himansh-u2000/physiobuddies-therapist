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
      // Prototype shadows are tinted with the `nav` navy (oklch(31% .08 238) ≈ #003553,
      // effectively identical to `nav` #003554), not black — RN only renders one shadow
      // layer, so these keep each CSS shadow's dominant (first) layer only.
      boxShadow: {
        sm: "0px 2px 8px rgba(0, 53, 84, 0.07)",
        md: "0px 8px 28px rgba(0, 53, 84, 0.12)",
        lg: "0px 20px 48px rgba(0, 53, 84, 0.16)",
        btn: "0px 4px 14px rgba(0, 53, 84, 0.22)",
      },
      elevation: {
        sm: 2,
        md: 6,
        lg: 12,
        btn: 4,
      },
    },
  },
  plugins: [],
};
