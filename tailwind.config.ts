import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}","./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        fog: "#64748B",
        brand: { 50: "#EFF6FF", 100: "#DBEAFE", 200: "#BFDBFE", 300: "#93C5FD", 400: "#60A5FA", 500: "#2563EB", 700: "#1D4ED8", 800: "#1E3A8A" },
        accent: { 50: "#FEF2F2", 100: "#FEE2E2", 200: "#FECACA", 500: "#EF4444", 600: "#DC2626", 700: "#B91C1C" }
      },
      boxShadow: {
        glow: "0 22px 60px rgba(37, 99, 235, 0.16)",
        panel: "0 24px 80px rgba(15, 23, 42, 0.08)"
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
        display: ["ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
