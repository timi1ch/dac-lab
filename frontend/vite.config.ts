import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// В режиме разработки (npm run dev) запросы /api проксируются на локальный backend.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": env.BACKEND_URL || "http://127.0.0.1:8000" },
  },
  };
});
