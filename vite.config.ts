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
  const envDir = process.env.MAAK_VITE_ENV_DIR || process.cwd();
  const fileEnv = loadEnv(mode, envDir, "");
  const env = { ...fileEnv, ...process.env };
  const supabaseUrl = String(env.VITE_SUPABASE_URL || "").trim();
  const supabaseKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
  const apiTarget = env.MAAK_API_TARGET || "http://localhost:8787";
  const base = env.VITE_BASE || "./";

  let supabaseHost = "missing";
  try {
    supabaseHost = new URL(supabaseUrl).host || "missing";
  } catch {
    supabaseHost = "invalid";
  }
  console.log(
    `[maak] frontend env diagnostic: url_present=${Boolean(supabaseUrl)} key_present=${Boolean(supabaseKey)} url_host=${supabaseHost}`,
  );

  return {
    envDir,
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
      __MAAK_SUPABASE_ENV_PRESENT__: JSON.stringify(Boolean(supabaseUrl && supabaseKey)),
    },
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
