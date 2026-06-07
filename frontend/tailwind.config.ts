import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./store/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        paper: "#f7f8f5",
        line: "#d8ded6",
        moss: "#2f7668",
        amberline: "#b7791f",
        brick: "#a74d3d"
      }
    }
  },
  plugins: []
};

export default config;
