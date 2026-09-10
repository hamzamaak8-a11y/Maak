import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function normalizeLegacyPublicAssetUrls(): Plugin {
  return {
    name: "maak-normalize-legacy-public-assets",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(css|html|js|jsx|ts|tsx)$/.test(id)) return null;
      const normalized = code.replaceAll("/Maak/icon-192.png", "./icon-192.png");
      return normalized === code ? null : { code: normalized, map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.MAAK_API_TARGET || "http://localhost:8787";
  const base = env.VITE_BASE || "./";

  return {
    plugins: [normalizeLegacyPublicAssetUrls(), react()],
    base,
    server: {
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
