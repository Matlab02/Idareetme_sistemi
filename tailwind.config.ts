import type { Config } from "tailwindcss";
export default { content: ["./src/**/*.{ts,tsx}"], darkMode: ["class"], theme: { extend: { colors: { ink: "#0b162b", brand: "#2774e6", ai: "#7c3aed" }, boxShadow: { card: "0 1px 2px rgba(15,23,42,.04),0 10px 25px rgba(15,23,42,.06)" } } }, plugins: [] } satisfies Config;
