import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const stateFile = path.resolve(process.env.MAAK_E2E_STATE_FILE || "test-results/e2e-state.json");

function run(script: string, args: string[] = []): void {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: { ...process.env, MAAK_E2E_STATE_FILE: stateFile },
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status ?? "unknown"}`);
}

export default async function globalSetup(): Promise<void> {
  const required = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "MAAK_E2E_PROVIDER_PASSWORD",
    "MAAK_E2E_CUSTOMER_PASSWORD",
    "MAAK_E2E_ADMIN_PASSWORD",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing E2E environment variables: ${missing.join(", ")}`);

  process.env.MAAK_E2E_STATE_FILE = stateFile;
  run("scripts/seed-e2e.mjs");
  run("scripts/seed-e2e-fixtures.mjs");
}
