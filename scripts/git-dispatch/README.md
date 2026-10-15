# Git Dispatch CLI

Local and CI automation tool for dispatching Jules coding agents against the `cloudflare-os-starter` repository using `@google/jules-sdk`.

## Quick Start

```bash
export JULES_API_KEY="your-api-key"

# Dry run preview
node scripts/git-dispatch/index.ts --prompt "Add unit tests for deploy validation" --dry-run

# Live dispatch to GitHub
node scripts/git-dispatch/index.ts --prompt "Fix Cloudflare Access JWT validation in gatekeeper"
```

## Structure (Typed Service Contract Pattern)

| File | Purpose |
|---|---|
| `spec.ts` | Type definitions and contract for dispatch input, errors, and result |
| `handler.ts` | Execution logic invoking Jules SDK with full error capture |
| `index.ts` | CLI wrapper using native `node:util.parseArgs` |
