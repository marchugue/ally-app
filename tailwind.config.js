/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  // Matches your existing content paths exactly
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ── Ally-jis web palette (replaces dark theme) ───────────────────
        // Backgrounds
        background:   "#FFFFFF",   // clean white — main screen bg
        surface:      "#FFFFFF",   // white — cards, inputs
        surfaceMuted: "#F9FAFB",   // clean neutral light gray — muted areas

        // Borders
        border: "#E5E7EB",         // clean neutral gray

        // Brand — forest green (replaces purple primary)
        // Flat value so `bg-primary` works without `.DEFAULT`
        primary:      "#1A6B3C",
        primaryDark:  "#155a33",
        primaryLight: "#22894E",

        // Accent — warm amber (replaces teal)
        accent: "#E8A838",

        // Text
        textPrimary:   "#111827",  // near-black
        textSecondary: "#6B7280",  // muted gray

        // Status
        danger:  "#EF4444",
        success: "#16A34A",
      },
      fontFamily: {
        sans: ["PlusJakartaSans_400Regular", "System"],
        fraunces: ["Fraunces_700Bold"],
        jakarta: ["PlusJakartaSans_400Regular"],
      },
    },
  },
  plugins: [],
};