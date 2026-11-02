import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Production presents sign-in. Tests and local dev leave VITE_ACCOUNTS_LIVE unset.
  define:
    mode === "production"
      ? { "import.meta.env.VITE_ACCOUNTS_LIVE": JSON.stringify("true") }
      : undefined,
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
