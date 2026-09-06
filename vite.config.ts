import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.MAAK_API_TARGET || "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
  server: {
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
