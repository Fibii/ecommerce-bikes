// Argument handling of scripts/deploy.sh. Run: npm run test:deploy
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const run = (args, env = {}) =>
  spawnSync("bash", ["scripts/deploy.sh", ...args], {
    encoding: "utf8",
    env: { ...process.env, APP_NAME: "", ...env },
  });

test("--dry-run prints the steps and runs no docker", () => {
  const r = run(["--dry-run", "--tag", "abc123"], {
    PORT: "4000",
    STOCK_SEED: "x",
  });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /docker build -t bikes:abc123 \./);
  assert.match(r.stdout, /--restart unless-stopped/);
  assert.match(r.stdout, /-p 4000:4000/);
  assert.match(r.stdout, /-e STOCK_SEED/);
  assert.doesNotMatch(r.stdout, /REVALIDATE_SECRET/);
});

test("the default tag is the git short sha", () => {
  const r = run(["--dry-run"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /docker build -t bikes:[0-9a-f]{7,} \./);
});

test("rejects unknown arguments", () => {
  const r = run(["--nope"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown argument/);
});

test("rejects a missing --tag value and a bad PORT", () => {
  assert.equal(run(["--tag"]).status, 2);
  assert.equal(run(["--dry-run"], { PORT: "abc" }).status, 2);
});

test("--help prints usage and exits 0", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /SINGLE INSTANCE ONLY/);
});
