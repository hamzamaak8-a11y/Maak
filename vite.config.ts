import { defineConfig, loadEnv, type OutputBundle, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function normalizeLegacyPublicAssetUrls(base: string): Plugin {
  const sourcePath = "/Maak/icon-192.png";
  const vitePublicPath = "/icon-192.png";
  const runtimePath = `${base.replace(/\/$/, "")}/icon-192.png`;

  const rewriteSource = (code: string) => code.replaceAll(sourcePath, vitePublicPath);
  const rewriteOutput = (bundle: OutputBundle) => {
    for (const asset of Object.values(bundle)) {
      if (asset.type === "asset" && typeof asset.source === "string") {
        asset.source = asset.source.replaceAll(vitePublicPath, runtimePath);
      } else if (asset.type === "chunk") {
        asset.code = rewriteSource(asset.code).replaceAll(vitePublicPath, runtimePath);
      }
    }
  };

  return {
    name: "maak-normalize-legacy-public-assets",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(css|html|js|jsx|ts|tsx)$/.test(id)) return null;
      const normalized = rewriteSource(code);
      return normalized === code ? null : { code: normalized, map: null };
    },
    generateBundle(_options, bundle) {
      rewriteOutput(bundle);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.MAAK_API_TARGET || "http://localhost:8787";
  const base = env.VITE_BASE || "./";

  return {
    plugins: [normalizeLegacyPublicAssetUrls(base), react()],
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
