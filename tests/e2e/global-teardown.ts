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

export default async function globalTeardown(): Promise<void> {
  run("scripts/seed-e2e-fixtures.mjs", ["--cleanup"]);
  run("scripts/seed-e2e.mjs", ["--cleanup"]);
}
