# Build and deploy tooling

How this repository builds Workers and deploys them, and why the tool boundary
looks the way it does.

## The division of labor

Cloudflare's official guidance ([Choosing between Wrangler & Vite][wrangler-vs-vite])
splits Workers tooling in two:

| Capability | Wrangler | Vite plugin / Vite+ |
| --- | --- | --- |
| Local dev, bindings, multi-Worker | ✅ | ✅ |
| **Deploy & resource management** | ✅ | ❌ — "use Wrangler after `vite build`" |
| Framework build pipeline, HMR | framework output | ✅ |
| Rust Workers | ✅ | ❌ |

Deployment always goes through `wrangler deploy`, even in fully Vite-based
projects. The Vite/Vite+ side owns *building*; Wrangler owns *deploying* and
managing resources (secrets, KV, R2, domains). This repository follows that
boundary exactly.

[wrangler-vs-vite]: https://developers.cloudflare.com/workers/local-development/wrangler-vs-vite/

## How this repo applies it

**Builds are Vite/Vite+ (`vp run`), deploys are Wrangler.**

- Every package builds through a Vite+ task or a Vite build (`vp run -F <pkg>
  build`), driven by `scripts/deploy.ts` → `buildCommands()`.
- The gatekeepers bundle with `capnweb-validate` (a Vite-based custom build)
  per their own `wrangler.jsonc` `build.command`.
- Each deployable package gets a generated `wrangler.prod.jsonc` (account,
  names, routes, bindings, observability), then `wrangler deploy --config
  wrangler.prod.jsonc` runs from the package directory.
- Wrangler is pinned per workspace (`catalog:` in `pnpm-workspace.yaml`); the
  generated configs pin `account_id` so a stray `CLOUDFLARE_ACCOUNT_ID` cannot
  redirect a deploy.

## Path aliasing: the plugin, not the fork option

Worker configs here import `defineConfig` from **`vite`**, not from the
`vite-plus` fork. Plain Vite's `resolve` options do **not** include
`tsconfigPaths` — that flag exists only in Vite+'s forked resolver
(`@voidzero-dev/vite-plus-core`). Two supported ways to get tsconfig `paths`
resolution:

1. **`vite-tsconfig-paths` plugin** (what this repo uses). Portable across
   both plain Vite and the Vite+ fork; no hard import of `vite-plus` needed,
   which upstream deliberately avoids (see the header comment in
   `scripts/vitest-task-vite-config.ts`).
2. Importing `defineConfig` from `vite-plus` and using
   `resolve: { tsconfigPaths: true }`. Couples every config to the fork and
   changes the type surface (`AllResolveOptions` vs `AllResolveOptions` from
   plain Vite); only worth it if a config also needs other fork-only options.

Mixing the two — `defineConfig` from `vite` with `resolve.tsconfigPaths: true`
— fails typecheck with
`Type '{ tsconfigPaths: boolean; }' has no properties in common with type
'AllResolveOptions'`. That mismatch is a typecheck error, not a runtime one:
the build would still resolve aliases at runtime if Vite+ ever ran the config,
but the standalone `tsc -p tsconfig.vite.json` step (which type-checks the
config against plain `vite`'s types) rejects it first.

## Local modifications and the submodule

The submodule (`cloudflare-os/`) carries a few deliberate local changes (CORS
handling in `workshop-backend/src/server.ts`, docs). It also carries the
upstream tool boundary untouched: `vite-tsconfig-paths` stays the aliasing
mechanism, and Wrangler stays the deploy mechanism. If an experiment replaces
the plugin with the fork option, the config files must move to `vite-plus`'s
`defineConfig` in the same change, or the typecheck step (`typecheck:app`,
which runs `tsc -p tsconfig.vite.json`) will fail before the build does.
