---
milestone: "1"
---

# Cloudflare OS Starter Development Goals

Continuously analyze the Cloudflare OS deployment starter for reliability, script safety, test coverage, and documentation alignment.

## Tools
- Typecheck & Test: `pnpm run lint`
- Deploy Validation: `pnpm check`
- Script Test Suite: `node --test 'scripts/**/*.test.ts'`

## Assessment Hints
- Ensure all custom gatekeepers follow the Typed Service Contracts pattern with exhaustive error codes and no unhandled throws.
- Verify `deployment.jsonc` schema validation covers all Cloudflare Access, D1, KV, and Worker configuration bindings.
- Check error handling in `scripts/deploy.ts` and ensure failures provide actionable remediation suggestions.

## Insight Hints
- Track test coverage across deployment scripts and custom gatekeepers.
- Identify deprecated Cloudflare Workers runtime APIs or Wrangler flags.

## Constraints
- Do NOT modify pinned upstream submodule files in `cloudflare-os/` directly.
- Preserve all existing environment variable checks and security assertions.
- Keep each task focused on a single module or script.
