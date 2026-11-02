import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// В режиме разработки (npm run dev) запросы /api проксируются на локальный backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: { "/api": "http://localhost:8000" },
  },
});
