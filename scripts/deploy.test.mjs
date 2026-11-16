// Argument handling of scripts/deploy.sh. Run: npm run test:deploy
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const run = (args, env = {}) =>
  spawnSync("bash", ["scripts/deploy.sh", ...args], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...env },
  });
const base = { PROJECT: "my-proj", REGION: "europe-west1" };

test("--dry-run prints the single-instance Cloud Run deploy", () => {
  const r = run(["--dry-run"], { ...base, SERVICE: "shop", STOCK_SEED: "x" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--project my-proj/);
  assert.match(r.stdout, /run deploy shop --source \. --region europe-west1/);
  for (const flag of [
    "--min-instances=1",
    "--max-instances=1",
    "--no-cpu-throttling",
  ]) {
    assert.ok(r.stdout.includes(flag), flag);
  }
  assert.match(r.stdout, /update-traffic shop .*--to-revisions=<previous>=100/);
});

test("--dry-run never prints the revalidate secret", () => {
  const r = run(["--dry-run"], { ...base, REVALIDATE_SECRET: "s3cret" });
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout, /s3cret/);
  assert.match(r.stdout, /--set-env-vars/);
});

test("the service name defaults to bikes", () => {
  assert.match(run(["--dry-run"], base).stdout, /run deploy bikes /);
});

test("requires PROJECT and REGION", () => {
  assert.equal(run(["--dry-run"], { REGION: "r" }).status, 2);
  assert.equal(run(["--dry-run"], { PROJECT: "p" }).status, 2);
});

test("rejects unknown arguments and a bad HEALTH_TIMEOUT", () => {
  const r = run(["--nope"], base);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown argument/);
  assert.equal(run(["--dry-run"], { ...base, HEALTH_TIMEOUT: "x" }).status, 2);
});

test("--help prints usage and exits 0", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /SINGLE INSTANCE ONLY/);
});
