import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // VITE_ACCOUNTS_LIVE comes from the environment (.env.<mode> or the build env).
  // Off unless it is exactly "true". Production stays off until approved.
  define: {
    "import.meta.env.VITE_ACCOUNTS_LIVE": JSON.stringify(
      (process.env.VITE_ACCOUNTS_LIVE ?? loadEnv(mode, process.cwd(), "VITE_").VITE_ACCOUNTS_LIVE) === "true" ? "true" : "",
    ),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
}));
