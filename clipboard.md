# Markr AI Workspace Bundle

Use this as a clean starting context for an AI coding tool.

Workspace: cloudflare-os-starter-2
Readiness: 0/100
Config files: 8
Approx config tokens: ~20.8K tok

## Immediate Risks

- No runnable commands documented (cloudflare-os/packages/ui/AGENTS.md): Add exact build, test, lint, and dev commands.
- No runnable commands documented (packages/chidori/docs/memory.md): Add exact build, test, lint, and dev commands.
- No runnable commands documented (packages/chidori/docs/your-first-agent.md): Add exact build, test, lint, and dev commands.

## Config Files

### cloudflare-os/AGENTS.md

Kind: Agent · ~10.4K tok · commands documented, verification guidance, explicit constraints

```markdown
This project is building a platform for "vibe coded" personal applications and AI agents that run inside a strong sandbox.

The following files are commonly important to reference:

* packages/workshop-shared/node_modules/capnweb/README.md: Explains how to use Cap'n Web RPC, which is used extensively for client-server communications.
* packages/workshop-shared/src/api.ts: Defines the RPC API used between the frontend and backend.

The project structure is:

* packages/workshop-frontend: The Gadgets Workshop UI.
    * This is a pure single-page app, running entirely client-side.
    * It speaks to the backend using an RPC API over a persistent WebSocket connection.
    * Uses React, Kumo UI (https://kumo-ui.com/api/component-registry), Phosphor icons, and Vite.
* packages/workshop-backend: The Gadgets Workshop server.
    * Runs on Cloudflare Workers.
    * This is the **kernel**: it defines the architecture and is held to a higher bar than UI/gatekeeper code. Reviewers read *every line* of `workshop-backend` and of API changes in `workshop-shared`, so keep diffs here small and elegant. Concretely: doc-comment **every** exported member of the `workshop-shared` public API (types, consts, and functions — not just interfaces); never introduce a hand-written interface that mirrors an RPC interface plus an `as unknown as` cast (derive from the real type instead, or rethink the design); and prefer reusing existing mechanisms over adding parallel ones. Capability-based security note: a resource becomes "ambient" (auto-injected) only by user/admin configuration — a gatekeeper must never assert its own ambience. When a change to this package is large, split it by concern into separate PRs (and at minimum group commits so `workshop-backend`/`workshop-shared` can be reviewed apart from UI), since fewer kernel lines = easier review.
    * `format-blueprints/` holds the **output format** blueprints the deployment ships with, committed as data: a `<name>.gadget` archive plus a `<name>.json` sidecar giving its `blueprintId`, prose, and `output` presentation. `scripts/build-format-blueprints.mjs` globs that directory (override with `FORMAT_BLUEPRINTS_DIR`, which lets a fork ship its own set without touching this submodule) into the gitignored `src/generated/format-blueprints.ts`, so `build` and `test` both run the generator first (it rewrites the module only when the content changes, so the repeat invocations don't invalidate the downstream task cache). Replace one with `pnpm import:format-blueprint <export.gadget> <blueprintId>`, or add one with `pnpm import:format-blueprint <export.gadget> --new <name>`; never edit a `blueprintId` after deploy, since the install and promotion are keyed on it and a rename orphans the old entry. See `format-blueprints/README.md`.
* packages/workshop-shared: Shared API definitions between client and server.
    * This defines the application's RPC interface.
    * The RPC protocol is Cap'n Web, which has similar semantics to Cloudflare's Worker-to-Worker RPC system, while being able to run in a browser over WebSocket. Read the readme for details.
* packages/configurator-ui: Type-only component helpers used by optional gatekeeper resource configurator UI modules.
    * Gatekeeper configurator UI modules are compiled by `scripts/build-gatekeeper-configurator.ts` as part of package builds.
* packages/gatekeeper-*: Gatekeeper workers for external service integrations.
    * Each gatekeeper runs as a separate Cloudflare Worker.
    * Gatekeepers handle OAuth flows and provide sandboxed access to external APIs.
    * A gatekeeper may declare `VendorDescription.autoProvisionsAccount`: it can mint a connected account with no OAuth flow (via `GatekeeperVendor.createAccount()`, which takes no user identity). For such gatekeepers the deployment admin picks a per-vendor mode in the admin Gatekeepers panel — **disabled** / **optional** / **enabled** (default **optional**) — resolved in `provisioning-policy.ts`: `enabled` auto-provisions the account for every user (forced, and hidden from the Connectors list), `optional` lets each user opt in from the Connectors page, and `disabled` offers it to no one (existing accounts go dormant). The Workshop persists the account in the user DO like any connected account (the account capability — not an asserted identity — is the authority thereafter). The **account** (a `GatekeeperUser`) declares in its `AccountDescription` whether it provides an agent **singleton** (`singleton: { tsType }`) and/or a **management UI** (`providesUi`). The Workshop auto-provides the singleton to the owner's workspaces as an **ambient gatekeeper record**, folded into each chat's env as a **named chat binding** (named by the gatekeeper's `suggestedBindingName`; see `prepareChatBindings` in overseer.ts) that the agent reads in `executeCode` (`getSession`/`getAgentCatalog`), each read recorded as an observation. It is not bound to any gadget by default — most gadgets never call it programmatically — but the agent may wire it into a gadget's binding list with `setGadgetBinding` when the gadget's persistent code needs it. The UI is hosted at `/gatekeepers/$appId` (the gatekeeper's vendor id, e.g. `/gatekeepers/context`) via `startAppUi({ isAdmin })`. The two are orthogonal — an account can declare either, both, or neither.
* packages/mcp-shared: Shared implementation behind the two MCP gatekeepers — `gatekeeper-mcp` (endpoints a user pastes) and `gatekeeper-mcp-portal` (one admin-configured portal). Not a Worker; a library both import, holding the MCP client, the OAuth chain, the account DO base, the resource-URL scope grammar, and the queued-action store. See `packages/mcp-shared/README.md` and each connector's README.
    * The trust boundary is `tools.ts`, and nothing outside it reads a tool's annotations: a tool the server declares `readOnlyHint: true` runs as an observation, everything else is queued for approval, and auto-*applying* a write additionally requires a `vetted` endpoint — which only the portal can produce, via `MCP_PORTAL_TRUST_ANNOTATIONS`.
    * OAuth uses the official `@modelcontextprotocol/client`; always give SDK OAuth operations `sdkFetch(...)` so every request and redirect retains endpoint and SSRF checks.
* packages/gatekeeper-context: The Context Library — a gatekeeper whose account provides a singleton read session + a management UI, for authoring collections of context documents that agents read as observations. Collections have one of two visibilities: **private** (owned by a single account, readable/writable only by that account) and **public** (created/edited only by deployment admins, readable by everyone and auto-enabled for all users). It owns its state in three Durable Objects (`ContextCollectionDurableObject` for content, `UserLibraryDurableObject` for each account's own private collections, `LibraryRegistryDurableObject` for the domain's public set) plus a KV namespace. All data is namespaced by a `sharingDomain` (from the binding's props, see `domain.ts`) so multiple workshops sharing one gatekeeper instance stay isolated.
    * Its `GatekeeperVendor` entrypoint (bound as `GATEKEEPER_CONTEXT`) declares `autoProvisionsAccount` and mints a `ContextAccount` via `createAccount()` (no user identity is passed in; the account keys its private data by its own generated `accountId`). The account exposes the agent read session (`getSession()`), collection discovery metadata (`getAgentCatalog()`), and a management UI (`startAppUi({ isAdmin })`). The UI is a single-file React SPA in `app/` (Vite + Tailwind + Kumo) bundled by `build-app.mjs` into `src/generated/app.txt`.
* packages/gatekeeper-scheduler: Scheduled Tasks — an auto-provisioned gatekeeper whose account provides an ambient singleton for registering persistent workspace callbacks plus a read-only management UI. One account-scoped `ScheduleDriver` Durable Object stores enabled schedules and delivers them from a shared alarm; hook enablement remains in the Workshop Connections UI.
* packages/gatekeeper-cloudflare: Cloudflare OAuth, serving three unrelated purposes from one connected account — sign-in (`AUTH_GATEKEEPERS`), AI Gateway billing, and **Workers Observability** read-only telemetry resources. Two resource granularities (whole account, or one Worker) both map to the single indivisible `workers-observability.read` scope, so the capability boundary is the *binding*, not the grant.
    * Layering: `observability-api.ts` is the only place that talks HTTP; `observability-parse.ts` validates every response (no blind casts); `observability-session.ts` is the agent-facing session, where every read funnels through one `#observe` so no path returns data unaudited; `observability-discovery.ts` derives field names/values from a sampled events query.
    * Scopes fail closed to `BILLING_SCOPES`, and an omitted `resourceUrlPatterns` ("all resource types") is distinct from `[]` ("none"): a billing-only connection must not silently acquire telemetry access, and recording a wider grant than was made would make `ensureResources` short-circuit into a binding that 403s with no way to re-prompt.
    * Three provider behaviours return wrong-but-plausible data with no error, so none is trusted (all verified against a live account): `telemetry/keys`/`values` **ignore** the `filters` they accept, so a constrained discovery call is answered from a filtered `telemetry/query` sample or it would disclose the whole account; an unknown filter key matches nothing, which bites because a log's own fields are returned nested under `source` but indexed under their *bare* name (`{event: "x"}` → `source.event`, queried as `event`, hence `observabilityFieldKey` accepting the `source.` alias wherever a caller names a field); and `/accounts` pages at 20 by default, so it must be walked to the end.
    * Worker-scoped bindings prepend an immutable `$metadata.service` filter *and* re-filter the response, since a filter the provider silently ignored would leak another Worker's telemetry. A dropped event proves the filter was not applied, so the provider's own `count` is then withheld rather than reported (it would count the whole account) and the drop is logged at `error`; `statistics` is kept, since it describes what the query cost rather than how much matched. Pagination cursors come from the provider's raw events rather than the surviving ones, so a fully-foreign page can't stall pagination and hide the caller's own older data. Trace *summaries* are account-only (their shape describes the whole cross-service trace); a Worker binding can still fetch its own events for a known trace id. `calculate()` is the one read with no second line of defence — an aggregate can't be un-mixed — so it rests solely on the injected filter; that is accepted and documented on the method, with the group-by fix left as a follow-up.
    * A provider error message can quote a caller-supplied filter value back, so only its numeric `codes` are logged — filter *values* stay out of the audit trail (`summarizeFilter`), and the message travels to the caller who caused it.
    * Tests are two vitest projects: `vitest.config.ts` (Node, pure logic) and `vitest.worker.config.ts` (workerd, for `RpcTarget`/`RpcStub`/Durable Objects). The workerd suite reaches the gatekeeper through a `TestHooks` Durable Object because a `DurableObjectClass` carrying `ctx.props` is only reachable via `ctx.facets` — the way the overseer instantiates it.
    * `src/configurator/*.tsx` duplicate the resource-URL grammar from `resources.ts` and **must**: `build-gatekeeper-configurator.mjs` transpiles each per-file, stripping only `@gadgets/configurator-ui` and type-only imports, so they cannot import runtime helpers. `__tests__/configurator-url.test.ts` keeps the copies in step, and `configurator-fields.test.ts` drives `render` against a mocked runtime — the runtime's `clearFields` only drops an autocomplete's typed query, so a dependent field must *also* be nulled through `setValues` or the stale value silently survives into the resource URL.
* packages/router: The public origin of a deployed gadgets instance. Serves the workshop-frontend assets and routes by path prefix: `/api/*` and `/blueprint-screenshot/*` to the workshop backend, `/gatekeeper/<name>/*` to whichever gatekeepers are bound (discovered by scanning its own `GATEKEEPER_*` service bindings, so installing a gatekeeper is purely a binding change). The same worker doubles as the dev router (`pnpm dev-server`): with no `ASSETS` binding it proxies frontend requests to the Vite dev server instead.

Deployment admin settings (the `/admin` panel) follow a few conventions worth knowing when extending them:

* `packages/workshop-backend/src/admin-config.ts` defines `AdminConfig` — the deployment's "soft" customizations: agent instructions, banners/theme, and which gatekeeper connectors/resources are offered (plus the three-state mode for auto-provisioning gatekeepers, see `provisioning-policy.ts`). Connectors/resources default to enabled and the admin UI opts them *out*; auto-provisioning gatekeepers default to *optional*. **Authentication/authorization config (sign-in providers via `AUTH_GATEKEEPERS`, password login via `DISABLE_PASSWORD_AUTH`) is deliberately NOT here** — it stays env-var driven (`auth/config.ts`) so it can't be changed by a compromised admin session.
* The `AdminSettings` durable object owns the authoritative `AdminConfig` and mirrors it to a single reserved KV key (`.adminConfig`, see `isReservedBlueprintKey()`), so hot-path code (connect/agent) reads it with one cheap KV get via `readAdminConfig(env)`. The DO is the only writer (`updateAdminConfig(patch)`).
* Admin operations are exposed as an `AdminApi` capability obtained via `AuthenticatedApi.getAdminApi()` (returns null for non-admins). The `#isAdmin()` check happens once when the capability is minted, so the individual methods don't re-check.
* `user.ts:getGatekeeperClassFor()` is the single core chokepoint where disabled gatekeepers/resources are enforced before a capability is minted (gadget/agent code can't reach it directly).

Release pipeline (`scripts/release/`) — how customer instances get deployed:

* `build-release.ts` bundles every deployable worker byte-identically (wrangler dry-run with the pinned wrangler), builds the Access-mode frontend asset build, and generates the release manifest — the contract between this repo's CI and the deploy service, produced by `manifest-lib.ts` from each package's wrangler.jsonc with account-specific values replaced by placeholders (`$ACCOUNT_ID`, `$WORKER_NAME(...)`, `$SECRET(...)`, `$PUBLIC_BASE_URL`, ...).
* `upload-release.ts` mirrors the release to R2 content-addressed, manifest last; with `--candidate` the manifest lands under `candidates/<id>/` (invisible to the deploy service) so e2e can verify it, and `promote-release.ts` then copies it to `releases/<id>/` — publishing is that single all-or-nothing manifest copy. The copy is not isolated against concurrent promotions, so CI serializes promote runs (a GitLab resource group) and the script's newer-release guard skips candidates that a later release has already superseded.
* The manifest is covered by a golden-file test; after an intentional manifest change, regenerate with `UPDATE_GOLDEN=1 node --test scripts/release/manifest-lib.test.ts` and review the golden diff.
* Running the flow by hand (upload and promote need `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`):
    * `node scripts/release/build-release.ts --out release-out` — build everything into `release-out/` (id defaults to `r<CI_PIPELINE_IID>-<sha7>` in CI, `dev-<timestamp>` locally; override with `--release-id <id>`).
    * `node scripts/release/upload-release.ts --release release-out --candidate` — mirror to R2; omit `--candidate` to publish directly (bypasses the gate — CI never does this).
    * `node scripts/release/promote-release.ts --release-id <id>` — copy 

[Truncated by Markr for handoff safety]
```

### cloudflare-os/packages/gatekeeper-kit/AGENTS.md

Kind: Agent · 602 tok · 4 headings, commands documented, verification guidance

```markdown
# Gatekeeper Kit contributor notes

`@gadgets/gatekeeper-kit` is a library, not a deployable Worker. Do not add a `cloudflare.config.ts`:
the `wrangler.jsonc` generated from it is what makes release tooling treat this package as a
gatekeeper deployment.

## Package boundaries

- Only Layer 1 leaf modules are shipped. Layer 2 remains a proposal in
  [`../../plans/gatekeeper-kit.md`](../../plans/gatekeeper-kit.md).
- Keep leaf modules independently usable. Do not make one depend on a future assembly layer.
- Add a leaf, or a leaf option, only for behavior several gatekeepers share under one contract.
  Behavior only one gatekeeper has belongs in that gatekeeper. Support it with a plain TypeScript
  hook or callback on the leaf, or by implementing the canonical interface by hand. Do not add a
  variant for a single provider.
- Accept the narrowest structural KV surface a module needs. Pass stable `ctx.storage.kv` objects to
  modules that coordinate work by storage identity.
- Treat shipped storage keys and prefixes as compatibility. Use existing key and prefix options when
  porting a gatekeeper with a different layout.
- Public modules are explicit subpath exports in [`package.json`](package.json). Document new public
  symbols with JSDoc and add the subpath to the README inventory.

## Documentation ownership

- [`README.md`](README.md) maps the package and its modules.
- [`USAGE.md`](USAGE.md) owns cross-module integration guidance and operational sharp edges.
- Exported-symbol JSDoc owns the exact API contract visible in editors.
- [`../../plans/gatekeeper-kit.md`](../../plans/gatekeeper-kit.md) is the design record, including the
  unshipped Layer 2 proposal. Do not duplicate that proposal into current usage documentation.

## Verification

Use Node tests for pure logic. Use the workerd project for persisted RPC stubs, `RpcTarget`,
Durable Object behavior, and `crypto.subtle.timingSafeEqual`.

From the repository root:

```sh
pnpm --filter @gadgets/gatekeeper-kit test:run
vp run -F @gadgets/gatekeeper-kit build
```

```

### cloudflare-os/packages/ui/AGENTS.md

Kind: Agent · 399 tok · 3 headings, verification guidance

```markdown
# Shared UI

`@gadgets/ui` is the shared runtime React UI layer for the Workshop and gatekeeper management apps.
Kumo owns low-level controls and semantic tokens; this package owns reusable Gadgets interaction
patterns and composed components.

## Ownership

- Add a component here when at least two independent frontends need the same feature-independent
  behavior or when consistency across those frontends is an explicit product requirement.
- Keep product data fetching, routing, RPC, permissions, and domain workflows in the consuming app.
- Check Kumo before adding a primitive. Do not wrap Kumo solely to restyle or rename it.
- Export source directly. This package has no publish or emitted-build step and is marked private.
- Keep React and Kumo as peer dependencies so consumers use one runtime and design-system version.
- A Tailwind consumer must include `packages/ui/src` as an `@source`, because the shared components'
  utility classes are compiled by the consuming app.

## APIs And Tests

- Prefer a headless behavior primitive plus a Kumo adapter when both are real consumers' needs.
- Keep the headless model free of presentation policy and styled-only fields where practical.
- Preserve accessibility and input parity across mouse, keyboard, touch, and hybrid devices.
- Colocate tests and test observable contracts rather than package boundaries or framework behavior.

```

### cloudflare-os/packages/workshop-frontend/AGENTS.md

Kind: Agent · ~3.7K tok · 11 headings, commands documented, verification guidance

```markdown
# Workshop Frontend

This package is the Workshop single-page application. It uses React, TanStack Router, Tailwind,
and Kumo. Follow the repository-wide guidance in `../../AGENTS.md` in addition to this file.

## Architecture

Organize new code by product ownership first and implementation type second.

```text
src/
  routes/       TanStack route declarations and route-level wiring
  pages/        Substantial route-level screens that compose one or more features
  features/     Product features and their owned UI, hooks, and logic
  components/   UI and application primitives shared across unrelated features
  hooks/        Hooks shared across unrelated features
  utils/        Feature-independent utilities
```

The existing tree predates this convention. Apply it to new code and to code being substantially
reworked; do not migrate unrelated files opportunistically.

### Features

Feature directories own product behavior. A feature may contain components, hooks, tests, and
utilities that belong to that behavior.

Start a feature directory flat:

```text
features/chat/composer/
  ChatComposer.tsx
  ComposerAddMenu.tsx
  ComposerAddMenu.test.tsx
  useComposerDraft.ts
  composerTokens.ts
```

Do not create `components/`, `hooks/`, `helpers/`, or `tests/` subdirectories merely to classify
files by implementation type. File names already communicate those types, and tests should usually
remain beside their subject.

Introduce a subdirectory when a coherent internal subsystem has several files or the flat directory
becomes difficult to scan. Name it after its responsibility, such as `draft/`, `tokens/`,
`attachments/`, or `slash-commands/`; avoid generic `helpers/` buckets.

Organize by the reason files change together. Feature-based organization does not replace the
one-component-per-file model.

### Components

Create a separate component file when the component has at least one of these properties:

- It owns meaningful state, effects, or interaction behavior.
- It is independently testable or reusable.
- It represents a distinct UI responsibility.
- Keeping it inline makes the parent difficult to understand.
- It has grown supporting types or logic that obscure the parent's main flow.

Keep small stateless rendering helpers private in their parent's file when they are only used there
and remain easy to understand. Extract them beside the parent when they develop their own behavior
or tests.

Use PascalCase filenames for components and camelCase filenames for hooks and non-component
modules. Prefer direct imports; do not add a barrel file solely to shorten paths.

### Pages And Routes

Files under `src/routes/` define routes. Keep them focused on route concerns: parameters, search
validation, loaders, navigation, and composing the route's page.

A page is a composition boundary, not necessarily a feature. A page may combine several features,
and a feature may appear on several pages.

A small page may remain in its route file. Move a substantial page implementation to
`src/pages/<page>/`, where it can compose feature components. Components and hooks meaningful only
to that page stay in the page directory rather than global `components/` or `hooks/`. Apply the same
flat-first and responsibility-based subdivision rules used for features. Keeping page support code
outside `src/routes/` also keeps it out of TanStack Router's file scanning.

Name every route-level screen component under `src/pages/` with a `Page.tsx` suffix, such as
`HomePage.tsx` or `WorkspacePage.tsx`. Supporting components keep names that describe their own
responsibility, such as `HomeTaskSuggestions.tsx`.

Do not move product behavior into a page merely because the page currently consumes it. Behavior
with independent product meaning or use across pages belongs to `src/features/<feature>/`.

Default uncertain code to the page and promote it when ownership broadens. The current Home page is
an example of code that predates this rule: `components/AppShell/HomeTaskSuggestions.tsx` and
`components/MeshBackground.tsx` have `routes/index.tsx` as their only production consumer. They are
Home-specific composition and presentation rather than shared AppShell primitives, so their target
organization would be:

```text
pages/home/
  HomePage.tsx
  HomeTaskSuggestions.tsx
  MeshBackground.tsx
```

If task suggestions later become an independently meaningful workflow used by other pages, promote
that code to a feature such as `features/task-suggestions/`. Do not begin there based only on
speculative reuse.

Do not edit `src/routeTree.gen.ts`; it is generated.

### Shared Code

`src/components/` and `src/hooks/` are shared application infrastructure, not default destinations.
Code should begin under the feature that owns its behavior.

Reuse alone does not make code generic:

- If multiple parts of one feature use an item, move it to their nearest common feature directory.
- If another feature consumes a concept still owned by the original feature, keep it exported from
  that feature.
- Promote an item to global `components/` or `hooks/` only when unrelated features use the same
  feature-independent abstraction and its API no longer depends on its original feature.
- Do not merge components merely because they look similar. Avoid generic prop-heavy abstractions
  that erase important domain behavior.

Move code only as high in the hierarchy as its ownership requires. For example, a skill pill shared
by the composer and chat history belongs to `features/chat/`, while a generic application icon
button belongs to `components/`.

### Component APIs And Composition

Represent props that are valid only together as one object or a discriminated union. Do not permit
partial configurations:

```tsx
// Avoid: callers can provide a count with no way to dismiss it.
count?: number;
onDismiss?: () => void;

// Prefer: the capability is either complete or absent.
notice?: { count: number; onDismiss: () => void };
```

A controlled value requires a change callback. Otherwise, the component owns the value. Do not copy
a controlled prop into local state with an Effect:

```tsx
// Controlled
value: string;
onValueChange: (value: string) => void;

// Uncontrolled
initialValue?: string;
```

Name callbacks `on<Action>` and pass domain values rather than React setters or browser events. For
example, expose `onModelChange(modelId)` rather than `setSelectedModel` or `onChange(event)`.

Add `children`, named slots, variants, `className`, DOM prop passthrough, or imperative refs only
when a current caller needs that control. Do not add them in anticipation of reuse.

Use context for application-wide values such as authentication, theme, and toasts. Pass
instance-specific feature data and actions through props; do not introduce context merely to avoid
passing them through one or two component levels.

Extract a component or hook when the extracted unit owns a complete concern, such as state and its
transitions, an Effect lifecycle and cleanup, an accessible interaction, or a pure transformation
that can be tested independently. Keep code together when the child would mostly forward markup or
would need the parent's refs, setters, and synchronization callbacks to function.

## Kumo And Styling

Use Kumo components and Kumo semantic design tokens by default. Check Kumo before creating a custom
control, interaction pattern, or visual primitive. Existing Workshop wrappers may be used when they
provide established application behavior that Kumo does not provide directly.

Custom colors and design tokens outside Kumo are prohibited unless the user explicitly requests
them. In particular, do not add:

- Hex, RGB, HSL, or OKLCH color literals in component styles.
- Arbitrary Tailwind color values.
- New application-specific color variables or token families.
- Feature-local replacements for Kumo surfaces, borders, text, status, focus, or interaction tokens.

Use Kumo semantic classes such as `bg-kumo-base`, `text-kumo-subtle`, and `border-kumo-line` rather
than palette colors. Global Kumo token theming is a deliberate application-level decision and must
not be introduced or changed as part of ordinary feature work.

Legacy custom tokens and color declarations in the current codebase are not precedent for new code.
Do not expand their use. Migrate them only as part of explicitly scoped cleanup.

Tailwind remains appropriate for structure: layout, spacing, sizing, positioning, responsive
behavior, and typography. Use custom CSS only for technical behavior that Kumo and utilities cannot
express, such as editor integration or measured overlays; custom CSS does not relax the color and
token rules.

When a Kumo component is unsuitable, record the concrete behavioral or accessibility gap before
adding a shared Workshop abstraction. Do not wrap Kumo solely to restyle it.

## React

- Define components and hooks as named `const` arrow functions by default. This keeps declarations
  before use and avoids relying on function-declaration hoisting. Type props directly rather than
  using `React.FC`. Ensure components wrapped in `memo`, `forwardRef`, or similar APIs retain an
  explicit name for React DevTools and stack traces, using `displayName` when inference is unclear.
- Treat Effects as an escape hatch for synchronizing React with an external system, not as a
  general state-management tool. Follow React's
  [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) guidance.
- Do not use an Effect to derive render data from props or state. Calculate it during render instead.
- Do not use an Effect for logic caused by a user interaction. Run it in the event handler that
  knows what happened.
- Do not use an Effect to keep two pieces of React state synchronized. Prefer a single source of
  truth, derived values, controlled components, or lifting state.
- Prefer a component `key` when an identity change should reset the component's state.
- Prefer `useSyncExternalStore` for external store subscriptions when it fits.
- Effects that fetch or subscribe must clean up stale work and subscriptions. Components must remain
  correct when Effects are restarted or mounted again in development.
- Avoid chains of Effects that update state only to trigger another Effect.
- Keep state as close as possible to the behavior that owns it.
- Extract a hook when it represents a coherent behavior or is reused, not simply to shorten a file.
- Do not add `useMemo` or `useCallback` by default; use them when identity or expensive computation
  has a concrete effect, and follow existing compiler guidance.
- Preserve keyboard behavior, focus management, and accessible names when extracting interactive UI.
- RPC stubs must follow the disposal and React state rules in the repository-wide `AGENTS.md`.

## Comments

Prefer code that communicates its intent through names, types, and structure. Do not add comments
that narrate what the next line or block already says.

Comments are appropriate for gotchas, non-obvious invariants, external constraints, security or
performance reasoning, and deliberate departures from a convention. Explain why the surprising
choice is necessary, not the mechanics visible in the code. Remove or update comments when the
constraint they describe no longer exists.

## Tests

Colocate unit tests with their subject using `*.test.ts` or `*.test.tsx`. Use a feature-level
`__tests__/` directory only for scenarios that span several modules and have no single owner.

Tests should either protect behavior whose regression would be important, or verify real logic
introduced by the change. Do not test React, JavaScript, TypeScript, Kumo, or another framework's
own behavior merely because it appears in the implementation.

Test observable contracts, product rules, state transitions, accessibility behavior, race handling,
and failure paths. Avoid assertions coupled only to implementation details, trivial passthrough
markup, or behavior already guaranteed by types and the underlying platform. A test should have a
clear failure whose meaning matters to this application.

Behavior-preserving moves should keep tests unchanged apart from imports. Add focused coverage when
an extraction exposes important previously untested logic; do not add tests solely because a file
or component boundary now exists.

Useful commands from the public workspace root:

```bash
pnpm --filter @gadgets/workshop-frontend test:run
pnpm exec tsc -p packages/workshop-frontend/tsconfig.json
pnpm exec tsc -p packages/workshop-frontend/tsconfig.vite.json
pnpm exec vp run -F @gadgets/workshop-frontend build
```

Run `pnpm lint` from the public workspace root before pushing when the broader workspace state
allows it.

```

### packages/chidori/docs/memory.md

Kind: Context · ~1.6K tok · 7 headings

```markdown
---
title: "Memory"
description: "chidori.memory: a persistent cross-run key-value store — namespacing, on-disk anchoring, replay semantics."
---

# Memory — persistent key-value storage across runs

> `chidori.memory` is a small, namespaced, JSON key-value store that persists
> **across runs** — the place for what an agent learns in one session and
> should remember in the next. **Related:** [Core Concepts](./core-concepts.md),
> [Replay & Resume](./replay.md), [Value Checkpoints](./value-checkpoints.md),
> [Durable Storage](./durable-storage.md). API reference:
> [Host API](./host-api.md). Example:
> `examples/release-notes-concierge/agent.ts` (the house-style pattern).

## What this is

Runs are durable, but a run's journal belongs to *that run*. `chidori.memory`
is the store that outlives the run: JSON values keyed by string, anchored to
the agent on disk, readable by every subsequent session of the same agent.

```ts
await chidori.memory.set("house-style", learned);
const style = await chidori.memory.get("house-style");   // null when absent
const items = await chidori.memory.list({ prefix: "user_" });
await chidori.memory.delete("house-style");              // → true if it existed
await chidori.memory.clear();                             // empty this namespace
```

The canonical pattern (from `examples/release-notes-concierge`): at the end of
a session, distill what the human's feedback taught the agent and `set` it;
at the start of the next session, `get` it and fold it into the system prompt.

## API

Every method takes a trailing `options` object; the options are exactly
`namespace` (default `"default"`) and, on `list` only, `prefix`.

- `set(key, value, options?)` → `null`. `value` is any JSON-compatible value.
- `get(key, options?)` → the stored value, or `null` when the key is absent.
- `delete(key, options?)` → resolves to whether the key existed: `true` if it
  did, else `false`.
- `list(options?)` → an array of `{ key, value }` entries; with `prefix`, only
  entries whose keys start with that prefix.
- `clear(options?)` → `null`; empties the namespace (the file remains, as
  `{}`).

Namespaces isolate stores: `get("k", { namespace: "per-user" })` never sees
the default namespace's `k`. Each namespace is its own file,
`.chidori/memory/<namespace>.json`, anchored to the workspace root (below).
Namespace names are sanitized for the filesystem — any character outside
`[A-Za-z0-9_-]` becomes `_`.

## Where it lives on disk

Each namespace is one pretty-printed JSON object at:

```
<root>/.chidori/memory/<namespace>.json
```

`<root>` resolves in precedence order:

1. **`CHIDORI_MEMORY_DIR`** — explicit override, wins outright.
2. **The run's workspace root** — the agent file's directory under
   `run`/`resume`/`serve` and for detached agents, or
   `CHIDORI_WORKSPACE_ROOT` when set.
3. **The process cwd** — last-resort fallback for bare embeddings with no
   known root. (Unlike `chidori.workspace`, memory never hard-fails on a
   missing root.)

So memory is **anchored to the agent, like runs and workspace files**:
running the same agent from a different working directory sees the same
store, and two different agent directories are two independent stores.

## Record vs. replay

Every memory action is a journaled `memory` host call. Live, the action
executes against the JSON file (a whole-file load → mutate → save for writes)
and its result is journaled; on replay, the journaled result is returned and
the store is **not touched** — a replayed `get` returns the value as it was at
recording time even if the file has changed since, and a replayed `set` does
not re-write the file ([Replay & Resume](./replay.md)). Only live continuation
past the recorded frontier hits the store again.

Memory calls are never policy-gated: they behave the same under the
`supervised` profile (the bare `chidori run` default), the `untrusted`
profile, and `--trusted` — see the [CLI reference](./cli.md).

## Concurrency

Writes are whole-file read-modify-write with **no cross-process locking**.
Within a single run, host calls execute one at a time, so an agent's own
actions never interleave. But concurrent writers sharing one store — parallel
actors, a detached-agent fleet, or two processes anchored at the same root —
can interleave load/save and lose updates (last write wins at file
granularity). Keep memory for low-contention state (preferences, distilled
lessons, per-user notes under distinct keys or namespaces); use
[signals/mailboxes](./signals.md) or [actor messages](./actors.md) for
cross-agent coordination.

## Memory vs. its neighbors

This table is the canonical boundary map for Chidori's state surfaces — the
other state pages link here rather than restating it.

| Store | Scope | For |
|---|---|---|
| `chidori.memory` | The agent, across all runs | What the agent has learned; small JSON state |
| `chidori.workspace` | The project directory, across runs | Deliverable files (documents, code) — policy-gated |
| `chidori.step` | One run's journal | Memoizing expensive pure compute within a run ([Value Checkpoints](./value-checkpoints.md)) |
| Run journal | One run | Every journaled host call; replay/resume ([Replay & Resume](./replay.md)) |
| Run store | The `.chidori/runs/` tree, plus an optional durable mirror | Where the journal's bytes physically live — backends, hydration, machine-loss survival ([Durable Storage](./durable-storage.md)) |

```

### packages/chidori/docs/your-first-agent.md

Kind: AI Doc · ~2.1K tok · 7 headings, verification guidance

```markdown
---
title: "Your First Agent"
description: "A hands-on tutorial: write a durable agent from scratch, pause it for approval, replay it for $0, and check it into CI."
---

# Your first agent

[Getting Started](./getting-started.md) gets you from install to a served,
pausable agent. This tutorial has you **write your own agent** and walks it
through the full durability loop: run it, trace its journal, pause it for a
human, replay it with zero LLM calls, and turn the recording into a CI
test. Plan for about fifteen minutes.

You need the `chidori` binary and a connected model —
[Getting Started](./getting-started.md) covers both (`chidori model-login`
or a provider key). Work in the project `chidori init` scaffolded there, or
any fresh directory.

> **No API key?** Set `CHIDORI_TEST_LLM_RESPONSE="(test reply)"` and every
> prompt call returns that static string instead of calling a provider — so
> the model won't actually exercise the tool, but the durability mechanics
> this tutorial is about (journaling, pause, replay, verify) behave
> identically.

## 1. Write the agent

An agent is one ordinary TypeScript file. Save this as `research.ts`:

```ts
import { chidori, run, defineTool } from "chidori:agent";

const NOTES = [
  "2026-05-04 standup: replay divergence bug traced to unseeded RNG in retry helper.",
  "2026-05-11 standup: prompt cache hit rate at 87% after context() refactor.",
  "2026-05-18 standup: actors supervision tree shipped; joins fold logs correctly.",
];

// A tool is just a function with a documented signature; closures over
// NOTES work, and every invocation is journaled.
const searchNotes = defineTool({
  name: "search_notes",
  description: "Keyword search over the team's standup notes.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Search keyword" } },
    required: ["query"],
  },
  run: async ({ query }: { query: string }) =>
    NOTES.filter((n) => n.toLowerCase().includes(query.toLowerCase())),
});

run(async (input: { question: string }) => {
  await chidori.log("Researching", { question: input.question });

  // One call runs the whole provider tool-use loop, up to maxTurns.
  const answer = await chidori.prompt(
    `Answer from the standup notes, citing dates: ${input.question}`,
    { tools: [searchNotes], maxTurns: 4, type: "final" },
  );

  // Pause for a human. `details` carries the artifact under review, so the
  // approval is never blind.
  const ship = await chidori.input("Publish this answer?", {
    type: "approval",
    choices: ["yes", "no"],
    default: "no",
    details: answer,
  });

  return { answer, published: ship.toLowerCase() === "yes" };
});
```

Three things to notice before running it:

- **Every side effect goes through a host call.** `chidori.log`,
  `chidori.prompt`, `chidori.input` — each is recorded in the run's
  journal. The `if`s, `await`s, and string munging between them are plain
  TypeScript.
- **The tool needs no registration** — a tool is just a function, and you
  pass the `defineTool` handle straight into `prompt()`
  ([Core Concepts](./core-concepts.md) covers the tool model).
- **Type the input with an object type, not an `interface`** — interfaces
  fail the handler's JSON constraint with a confusing error
  ([Host API](./host-api.md#agent-shape)).

## 2. Run it

```bash
chidori run research.ts --input question="what happened with the prompt cache?"
```

The model runs the tool loop — calling `search_notes`, reading the results,
composing an answer — and then the run **stops and asks you**:

```text
Publish this answer? [yes/no]
```

The answer text prints above the prompt — that's `details`. Type `yes`. The
run completes and prints its JSON output, something like:

```json
{
  "answer": "…the 2026-05-11 note reports an 87% prompt cache hit rate…",
  "published": true
}
```

> `chidori run` asks for approval before *powerful* effects — this agent's
> tool is pure in-VM compute, so the only pause you see is your own
> `input()` gate; postures and `--trusted` are in the
> [CLI reference](./cli.md#approval-postures).

## 3. Read the record

Every run journals to `.chidori/runs/<run_id>/` next to the agent file. Look
at what was recorded:

```bash
RUN_ID=$(ls -t .chidori/runs | head -1)
chidori trace "$RUN_ID"
```

The trace is the run's complete story: the `log` call, each model turn and
`search_notes` invocation inside the prompt loop, your `input()` answer, and
the token counts and cost of every prompt. This journal (the run's call
log) — not a framework abstraction — is what makes everything in the next
two steps possible.

## 4. Replay it for $0

The concept is *replay*; the CLI command that performs it is
`chidori resume` (one command covers both replaying a finished run and
resuming a paused one — a completed journal simply has nothing left to
continue):

```bash
chidori resume research.ts "$RUN_ID"
```

The agent code re-executes from the top — but every host call returns its
recorded result from the journal instead of touching the world. No model is
called, no tokens are billed, nobody is asked to approve anything, and the
output is byte-identical to step 2. This is the same mechanism that powers
crash recovery: a run that dies halfway replays to the frontier of its
journal and **continues live from there** ([how replay works](./replay.md)).

Three variants worth knowing now:

- `chidori resume research.ts <run_id> --allow-source-change` — replay
  against *edited* agent code, divergence-checked. Fix a bug three runs deep
  without re-paying the first three runs.
- `chidori dev research.ts` — the edit-iterate loop as a command: it watches
  the file and re-runs on every save, replaying recorded calls from the
  journal so edits cost zero tokens.
- A paused server-mode session resumes the same way, minutes or days later,
  in a fresh process ([Signals](./signals.md)).

## 5. Turn the recording into a test

Don't commit the raw run directory — it contains a multi-MB snapshot blob.
Export just the four small artifacts `verify` reads, and commit those:

```bash
chidori export "$RUN_ID" --fixture tests/fixtures
git add tests/fixtures
```

Then, in CI:

```bash
chidori verify research.ts "$RUN_ID" --runs-dir tests/fixtures
```

`verify` replays the run with **no providers, no tools, and the `untrusted`
policy profile** and asserts it completes with byte-identical output. Exit
code 0 means the agent's behavior hasn't drifted from the recording — a
full integration test of your agent, prompts, tool loop, approval gate and
all, that costs $0 and runs in milliseconds. Full contract:
[Replay as test](./replay.md#replay-as-test); see
[Value Checkpoints](./value-checkpoints.md) for bounding replay cost as
runs grow.

## Where next

- [Core Concepts](./core-concepts.md) — the full host-function surface and
  the mental model behind it.
- [Common Patterns](./patterns.md) — approval gates, fan-out, multiplayer
  review, scheduled agents: which primitive fits which job.
- [Host API Reference](./host-api.md) — every `chidori.*` method, option by
  option.
- `chidori serve research.ts --port 8080` turns this same file into an HTTP
  session API where `input()` pauses become resumable sessions —
  [Running Modes](./running-modes.md).

```

### packages/tardigrade/AGENTS.md

Kind: Agent · ~1.0K tok · 7 headings, commands documented, verification guidance

```markdown
# AGENTS.md

[docs/start-here/Welcome.mdx](docs/start-here/Welcome.mdx) introduces the framework and links its published documentation. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, the gate, and pull requests.

## Design

No silent hardcoding. When the framework applies a policy value, such as a cap, a threshold, a timeout, or a limit, the consumer must be able to see it and set it. Export the default, accept an override at the call site or on the surface that applies it, and make the effect visible in the output when the policy changes what the model sees. A constant a consumer can read but cannot change is a leaky abstraction; be explicit instead.

## Formal verification tools

On this workstation, TLAPS is installed at `~/.local/opt/tlaps` and TLC at `~/.local/opt/tla2tools/tla2tools.jar`. Use these paths before searching for or downloading tools. `~/.local/opt/tlaps/bin/tlapm --version` identifies the installed proof manager. Java is available at `/opt/homebrew/opt/openjdk/bin/java`.

```sh
~/.local/opt/tlaps/bin/tlapm --strict --nofp --cache-dir /tmp/tardigrade-tlaps-proof packages/deprecated/core/tla/component/ResponseIdentity.tla
TLA_JAVA=/opt/homebrew/opt/openjdk/bin/java TLA2TOOLS_JAR="$HOME/.local/opt/tla2tools/tla2tools.jar" bun run tla InteractionSubstitution
```

TLAPS needs process inspection to launch its backends; a sandbox error from `/bin/ps` requires running the checker with that access. Keep generated proof caches outside the repository. TLAPS checks deductive proofs; TLC explores configured finite models. Neither alone proves that TypeScript implements the specification.

## Pull requests

- Title a pull request in the commit format, the same as any commit: `type(scope?): message`, 3 to 5 words. The title becomes the squash commit subject, so it lands in the log as written.
- The pull request body follows the rules in the global writing style. It is read cold, so it states the change and the reason in full.
- Prefer compact PR bodies: use minimal prose, an ASCII flow or architecture diagram, a logical file tree with per-file `+/-` counts, and one brief change note.

## Commits

- Use Conventional Commits: `type(scope?): message`.
- Keep the message to 3-5 words.
- Write no body and no trailers.

## Comments

- Go stdlib register: start with the identifier's name; one declarative sentence is the contract; further sentences only for constraints.
- State what the code cannot: the contract, the constraint, the why. Never narrate mechanics or edit history.
- Cite the spec or test that proves any property claimed (e.g. "tla/Reconcile.tla, NoVoid"). A citation can dangle visibly; a freehand assertion rots invisibly.
- No rhetorical uniqueness: avoid "the one X", "the canonical X", "never a second concept" as phrasing. When exactly-one is a real invariant, state what enforces it ("duplicate names throw at construction"); when it is not, describe the thing plainly.

## Style

Do not use em dashes, emoji, or "not X, but Y" framing in documentation, code, comments, commits, or pull requests.

Write a paragraph as one line. Editors wrap for the reader, and a hard wrap bakes one width into the source, so a one-word change reads as a reflowed block.

Write documentation greenfield. A page states what is true now. What changed, and what it replaced, belongs in the commit and the pull request. `bun run gate --only=lint:docs` checks the prose rules a code linter cannot see.

```

### packages/tardigrade/CLAUDE.md

Kind: Claude · ~1.0K tok · 7 headings, commands documented, verification guidance

```markdown
# AGENTS.md

[docs/start-here/Welcome.mdx](docs/start-here/Welcome.mdx) introduces the framework and links its published documentation. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, the gate, and pull requests.

## Design

No silent hardcoding. When the framework applies a policy value, such as a cap, a threshold, a timeout, or a limit, the consumer must be able to see it and set it. Export the default, accept an override at the call site or on the surface that applies it, and make the effect visible in the output when the policy changes what the model sees. A constant a consumer can read but cannot change is a leaky abstraction; be explicit instead.

## Formal verification tools

On this workstation, TLAPS is installed at `~/.local/opt/tlaps` and TLC at `~/.local/opt/tla2tools/tla2tools.jar`. Use these paths before searching for or downloading tools. `~/.local/opt/tlaps/bin/tlapm --version` identifies the installed proof manager. Java is available at `/opt/homebrew/opt/openjdk/bin/java`.

```sh
~/.local/opt/tlaps/bin/tlapm --strict --nofp --cache-dir /tmp/tardigrade-tlaps-proof packages/deprecated/core/tla/component/ResponseIdentity.tla
TLA_JAVA=/opt/homebrew/opt/openjdk/bin/java TLA2TOOLS_JAR="$HOME/.local/opt/tla2tools/tla2tools.jar" bun run tla InteractionSubstitution
```

TLAPS needs process inspection to launch its backends; a sandbox error from `/bin/ps` requires running the checker with that access. Keep generated proof caches outside the repository. TLAPS checks deductive proofs; TLC explores configured finite models. Neither alone proves that TypeScript implements the specification.

## Pull requests

- Title a pull request in the commit format, the same as any commit: `type(scope?): message`, 3 to 5 words. The title becomes the squash commit subject, so it lands in the log as written.
- The pull request body follows the rules in the global writing style. It is read cold, so it states the change and the reason in full.
- Prefer compact PR bodies: use minimal prose, an ASCII flow or architecture diagram, a logical file tree with per-file `+/-` counts, and one brief change note.

## Commits

- Use Conventional Commits: `type(scope?): message`.
- Keep the message to 3-5 words.
- Write no body and no trailers.

## Comments

- Go stdlib register: start with the identifier's name; one declarative sentence is the contract; further sentences only for constraints.
- State what the code cannot: the contract, the constraint, the why. Never narrate mechanics or edit history.
- Cite the spec or test that proves any property claimed (e.g. "tla/Reconcile.tla, NoVoid"). A citation can dangle visibly; a freehand assertion rots invisibly.
- No rhetorical uniqueness: avoid "the one X", "the canonical X", "never a second concept" as phrasing. When exactly-one is a real invariant, state what enforces it ("duplicate names throw at construction"); when it is not, describe the thing plainly.

## Style

Do not use em dashes, emoji, or "not X, but Y" framing in documentation, code, comments, commits, or pull requests.

Write a paragraph as one line. Editors wrap for the reader, and a hard wrap bakes one width into the source, so a one-word change reads as a reflowed block.

Write documentation greenfield. A page states what is true now. What changed, and what it replaced, belongs in the commit and the pull request. `bun run gate --only=lint:docs` checks the prose rules a code linter cannot see.

```

## Continuation Instruction

Continue from this workspace context. First resolve any Immediate Risks, then inspect the user task and use the documented commands to verify changes before summarizing work.
