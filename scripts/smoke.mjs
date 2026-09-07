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
  ["404.html contains /Maak/ base", notFound.includes('var BASE = "/Maak/"')],
  ["manifest uses /Maak/ start URL", manifest.includes('"start_url": "/Maak/"')],
  ["manifest uses /Maak/ scope", manifest.includes('"scope": "/Maak/"')],
  ["service worker has /Maak/ fallback", worker.includes("/Maak/index.html")],
  ["service worker excludes /api/", worker.includes("/api/")],
];

const failed = checks.filter(([, passed]) => !passed);
if (failed.length > 0) {
  console.error("Smoke check failed:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Smoke check passed: ${requiredFiles.length} artifacts + ${checks.length} content checks.`);
