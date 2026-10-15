import assert from "node:assert/strict";
import test from "node:test";
import { GitDispatchHandler } from "./handler.ts";
import type { DispatchInput } from "./spec.ts";

test("GitDispatchHandler contract: rejects empty prompt", async () => {
  const handler = new GitDispatchHandler();
  const result = await handler.execute({ prompt: "   " });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.error.code, "MISSING_PROMPT");
    assert.equal(result.error.recoverable, true);
  }
});

test("GitDispatchHandler logic: handles dry-run mode successfully", async () => {
  const handler = new GitDispatchHandler();
  const input: DispatchInput = {
    prompt: "Add health check endpoint",
    repo: "sjoerd2025/cloudflare-os-starter",
    baseBranch: "main",
    dryRun: true,
  };

  const result = await handler.execute(input);

  assert.equal(result.success, true);
  if (result.success) {
    assert.match(result.data.sessionId, /^dry-run-/);
    assert.equal(result.data.repo, "sjoerd2025/cloudflare-os-starter");
    assert.equal(result.data.baseBranch, "main");
    assert.equal(result.data.state, "SIMULATED");
  }
});

test("GitDispatchHandler safety: requires JULES_API_KEY in non-dry-run mode", async () => {
  const prevKey = process.env.JULES_API_KEY;
  delete process.env.JULES_API_KEY;

  try {
    const handler = new GitDispatchHandler();
    const result = await handler.execute({
      prompt: "Add unit tests",
      dryRun: false,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, "MISSING_API_KEY");
      assert.equal(result.error.recoverable, false);
    }
  } finally {
    if (prevKey) {
      process.env.JULES_API_KEY = prevKey;
    }
  }
});
