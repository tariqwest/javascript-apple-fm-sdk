# Upstream integration analysis and plan

**Date:** 2026-08-08  
**Project:** `javascript-apple-fm-sdk`  
**Scope:** Review referenced and overlapping Foundation Models projects for changes over ~the past two months (since 2026-06-08), and recommend integrations/updates for this SDK.

## Problem

Keep this SDK aligned with Apple’s Python FM SDK (and its `foundation-models-c` ABI), while selectively adopting product ideas from overlapping tooling (`afm` CLI, prior TS bindings) without chasing stale or Swift-only stacks.

## Current state

### What this project tracks

| Source | Role | Recent activity |
|--------|------|-----------------|
| [apple/python-apple-fm-sdk](https://github.com/apple/python-apple-fm-sdk) | Primary API + `foundation-models-c` | **Active** — v0.2.0 / v0.2.1, commits through **2026-07-07** |
| `reference/apple-on-device-ai` → [meridius-labs/apple-on-device-ai](https://github.com/meridius-labs/apple-on-device-ai) | Secondary TS/N-API + Zod patterns | **Stale** for product work (last meaningful releases **2025-08**); still useful as design reference |
| [rudrankriyam/Foundation-Models-Framework-CLI](https://github.com/rudrankriyam/Foundation-Models-Framework-CLI) (`afm`) | Overlapping Swift CLI / server / UI | **Active** through **2026-07** (Kit 2.1.0, serve UI, workbench) |
| Local `reference/` tree | Build input for dylib | **Missing in this checkout** — `build.sh` still expects `reference/python-apple-fm-sdk/foundation-models-c` |

- `apple/swift-apple-fm-sdk` does **not** exist as a public repo.

### Feature parity snapshot (vs Python v0.2.x)

Already present in this repo:

- `Attachment` / `ImageAttachment` and image OS/SDK error mapping
- `SystemLanguageModel.getContextSize()` and `tokenCount()` (prompt, instructions, schema, transcript, tools)
- Session respond/stream, tools, guided generation (Zod + `guide`), transcripts, use cases/guardrails
- `fmRelease` after some respond paths (**needs full audit vs Python #18**)

## Upstream findings (last ~2 months)

### apple/python-apple-fm-sdk (active — source of truth)

| When | Change | Our status |
|------|--------|------------|
| **v0.2.0** (2026-06-08) | Multimodal **Attachment / ImageAttachment** (WWDC 2026) | Present (`prompt.ts`, image error codes) |
| **v0.2.1** (2026-06-29) + **#15** (2026-06-22) | `context_size` + `token_count` for prompt / instructions / schema / transcript / tools | Present (`getContextSize`, `tokenCount`, integration tests) |
| **#14** | Clearer **unsupported image OS/SDK** errors | Present (`FMComposedPromptAddImageError`, `ImagePromptError`) |
| **#18** (2026-07-07) | **Release `composed_prompt` on all `respond()` paths** (leak fix) | Partially mirrored — needs full path audit vs Python |

- `foundation-models-c` lives in-tree under the Python repo (`FoundationModels.h`, `FoundationModelsCBindings.swift`).
- C headers/bindings changed in #14 and #15; N-API bindings must track those symbols.

### meridius-labs/apple-on-device-ai (stale for product ABI)

- No meaningful commits in the last two months; last release line ~2025-08.
- Valuable product lesson: **Vercel AI SDK** provider (`generateText` / `streamText` / `generateObject` / tools).
- **Do not** chase their native layer; keep Apple `foundation-models-c` + our N-API.

### rudrankriyam/Foundation-Models-Framework-CLI (`afm`) — main product overlap

Recent (Jun–Jul 2026):

- Bumped **FoundationModelsKit → 2.1.0**
- Internalized **AFMServer** (OpenAI-compatible local endpoints)
- **Browser workbench** (`serve --ui`)
- Docs toward **Foundation Lab / PCC bridge**

Overlapping / adjacent features:

- `session respond | stream | chat`
- `schema run` (structured output)
- `tool call` / `tool validate`
- Token counting / availability
- `--use-case content-tagging`
- **Adapters**
- **`afm serve`** OpenAI-compatible HTTP
- **`afm bridge`** signed Foundation Lab / PCC paths

Swift-only adapters/PCC bridge should **not** be reimplemented here until C FFI exposes them.

### Other signals

- [anthropics/ClaudeForFoundationModels](https://github.com/anthropics/ClaudeForFoundationModels) is active but a different product (Claude on FM infra) — market proof only.
- No strong second TypeScript “official-style” SDK emerged that supersedes the Python-parity approach.

## Proposed changes

### P0 — ABI and parity process

1. Pin and vendor `apple/python-apple-fm-sdk` (tag **≥ v0.2.1**, ideally post-**#18** commit) as submodule or subtree under `reference/`.
2. Rebuild `libFoundationModels.dylib` + N-API from that pin; add a version/pin note in README and AGENTS.md.
3. Diff `foundation-models-c` headers on every upstream bump; fail CI or a verify script if symbols drift.
4. Full composed-prompt lifetime audit vs Python #18 (`respond`, structured, stream start/cancel/error, tool loops); add cleanup test analogous to `test_composed_prompt_cleanup`.

### P1 — Docs and examples parity

5. Document “Compatible with python-apple-fm-sdk vX.Y.Z / commit …” and reference setup for contributors.
6. Map missing Python test themes into Vitest: image prompts, JSON guided generation edge cases, generable protocol cases, composed-prompt cleanup.
7. Examples: image prompts, token budget vs `getContextSize()`, transcript round-trip chat REPL.

### P2 — Product overlap with afm (without forking Swift)

8. Interop doc: when to use in-process SDK vs `afm serve`.
9. Optional OpenAI-compatible mini-server example or thin package backed by this SDK (`afm serve` demand, JS-native).
10. Schema/tool dry-run validate helpers inspired by `afm tool validate` / `schema run`.
11. Point advanced UI users at `afm serve --ui`; do not reimplement workbench in-tree initially.
12. Monitor FoundationModelsKit / afm for adapters and PCC; only add when `foundation-models-c` exposes APIs.

### P3 — Ecosystem adapters and deps

13. Optional Vercel AI SDK provider package/export on top of our session API (lesson from apple-on-device-ai).
14. **Zod 4** migration spike (highest-impact library bump; `generable`/`guide` are Zod-centric). Current: `zod ^3.25.67`.
15. Vitest 4 when convenient; keep TypeScript on 5.x until intentional TS 7 adoption.
16. Tighten Bun/Node engine floors once CI matrix exists.

### Explicit non-goals

- Reimplementing `afm bridge` / PCC signing in N-API without C FFI support
- Following stale apple-on-device-ai native/FFI fixes
- Depending on a non-existent `apple/swift-apple-fm-sdk` repo

## Success criteria

- `reference/` (or equivalent) pins a known-good `python-apple-fm-sdk` revision including `foundation-models-c`
- Published native artifacts rebuild cleanly from that pin
- Composed-prompt cleanup matches Python #18 with tests
- README states upstream compatibility pin
- Clear backlog items for OpenAI serve example, AI SDK provider, and Zod 4 without blocking ABI sync

## Ordered backlog

1. Pin/vendor `python-apple-fm-sdk` ≥ v0.2.1 (post-#18) and rebuild native artifacts
2. Composed-prompt lifetime audit + cleanup test
3. README/AGENTS compatible-with + reference setup
4. OpenAI-compatible serve example or thin package
5. Examples: images, token budgeting, transcript chat REPL
6. Optional Vercel AI SDK provider
7. Zod 4 migration spike
8. Monitor afm/FoundationModelsKit for adapters/PCC; integrate only via C FFI when available

## Dependency snapshot (at analysis time)

| Dep | Ours | Latest observed | Recommendation |
|-----|------|-----------------|----------------|
| zod | `^3.25.67` | 4.x | Plan Zod 4 compatibility pass |
| vitest | `^3.2.3` | 4.x | Upgrade when convenient |
| typescript | `^5.8.3` | 7.x line available | Stay on 5.x for now |
| napi (Cargo) | napi 2 | track napi-rs | Revisit only if Node matrix needs it |

## Bottom line

- **Must-integrate work from the last two months is almost all from Apple’s Python SDK:** images, context/token APIs, image error clarity, prompt cleanup. TS surface already covers most of that; the gap is **process** (pinned `foundation-models-c`, cleanup parity proof, published version alignment)—not greenfield features.
- **`afm` is the main product overlap:** local OpenAI server, schema/tool CLI UX, workbench, adapters/bridge. Best moves are **interop + optional JS server/examples**, not copying Swift internals.
- **apple-on-device-ai** is a dormant design reference; the durable idea is a **Vercel AI SDK adapter** on this stack.
- Next high-leverage library bump is **Zod 4**, after the upstream pin/cleanup work.
