import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");

const requiredFiles = [
  "index.html",
  "404.html",
  "admin/index.html",
  "admin/login/index.html",
  "manifest.webmanifest",
  "sw.js",
];

const missing = requiredFiles.filter((file) => !existsSync(join(dist, file)));
if (missing.length > 0) {
  console.error(`Smoke check failed: missing build artifacts: ${missing.join(", ")}`);
  process.exit(1);
}

const index = readFileSync(join(dist, "index.html"), "utf8");
const notFound = readFileSync(join(dist, "404.html"), "utf8");
const manifest = readFileSync(join(dist, "manifest.webmanifest"), "utf8");
const worker = readFileSync(join(dist, "sw.js"), "utf8");

const checks = [
  ["index.html is non-empty", index.trim().length > 0],
  ["404.html detects its base path dynamically", notFound.includes("var base = isGithubPages")],
  ["manifest uses relative start URL", manifest.includes('"start_url": "./"')],
  ["manifest uses relative scope", manifest.includes('"scope": "./"')],
  ["manifest uses relative ID", manifest.includes('"id": "./"')],
  ["service worker builds a relative app root", worker.includes('new URL("./", self.location)')],
  ["service worker uses a relative index fallback", worker.includes('new URL("./index.html", self.location)')],
  [
    "service worker bypasses /api/ requests",
    worker.includes('if (url.pathname.startsWith("/api/")) return;'),
  ],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length > 0) {
  console.error("Smoke check failed:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Smoke check passed: ${requiredFiles.length} artifacts + ${checks.length} content checks.`);
