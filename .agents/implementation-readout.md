# Implementation Readout: ts-apple-fm-sdk

This document describes how the project was planned and executed. For SDK usage instructions, see the top-level [README.md](../README.md).

## User Request

Translate the `python-apple-fm-sdk` into a TypeScript SDK, aiming for a near 1-to-1 translation while adhering to TypeScript/Bun/Node.js best practices. The new SDK should closely follow the structure and ergonomics of the Python SDK, leveraging FFI definitions and C-headers from `foundation-models-c`. A previously implemented TypeScript SDK, `apple-on-device-ai`, which uses Zod for type management, serves as a secondary reference. Use a TDD approach with stubbed tests based on docs.

## Key Design Decisions

| Decision | Selected Option | Rationale |
|----------|-----------------|-----------|
| FFI approach | Rust N-API addon behind a `NativeBindings` abstraction layer | Direct binding to the existing `foundation-models-c` dylib; works under both Bun and Node.js without changing the public API |
| Generable equivalent | Zod schemas + `guide()` helper | TypeScript-idiomatic, gives strong inference, and matches the `apple-on-device-ai` reference pattern |
| Test runner | bun:test | Fast, Jest-compatible API, works well with both Bun and Node |
| Package manager | Bun | Chosen to match the FFI runtime and the `bun:ffi` dependency |

## Architecture

```
src/
├── index.ts              # Public API barrel
├── core.ts               # SystemLanguageModel + enums
├── session.ts            # LanguageModelSession
├── prompt.ts             # Prompt, Attachment, ImageAttachment
├── transcript.ts         # Transcript
├── generable.ts          # generable() factory, GeneratedContent, GenerationID
├── generation-schema.ts  # GenerationSchema (FFI-backed)
├── generation-guide.ts   # guide() helpers and constraints
├── generation-options.ts # GenerationOptions, SamplingMode
├── tool.ts               # Abstract Tool class
├── errors.ts             # Error hierarchy + status code mapping
├── type-conversion.ts    # Zod-to-Swift type mapping
└── ffi/
    ├── types.ts          # C FFI type definitions
    ├── native.ts         # N-API loader + NativeBindings interface
    └── managed-object.ts # Reference counted object wrapper
```

## Implementation Phases (TDD)

1. **Phase 0 — Scaffolding** (`package.json`, `tsconfig.json`, `bun test`, `build.sh`, `.gitignore`)
2. **Phase 1 — Foundation** (`errors.ts`, `ffi/types.ts`, `ffi/native.ts`, `ffi/managed-object.ts`, `type-conversion.ts`)
3. **Phase 2 — Core** (`core.ts`, `generation-options.ts`)
4. **Phase 3 — Session & Prompt** (`session.ts`, `prompt.ts`)
5. **Phase 4 — Guided Generation** (`generation-guide.ts`, `generation-schema.ts`, `generable.ts`)
6. **Phase 5 — Tools** (`tool.ts`)
7. **Phase 6 — Transcript & Token Counting** (`transcript.ts`)
8. **Phase 7 — Integration** (`index.ts`, `AGENTS.md`, type check, tests)

Tests were written before implementations for each phase (e.g., `errors.test.ts` before `errors.ts`, `generation-options.test.ts` before `generation-options.ts`).

## Testing

- **Test runner**: `bun:test`
- **Total tests**: 118
  - 81 passing (pure logic)
  - 30 skipped (native FFI integration tests, gated by `FM_NATIVE=1`)
  - 7 todo (token counting async callbacks)
- **Type check**: `tsc --noEmit` passes cleanly
- **Validation**: `bun test` and `bun run check` both succeed

## Known Limitations / Next Steps

- The FFI callback mechanism (`FMLanguageModelSessionRespond`, `FMLanguageModelSessionResponseStreamIterate`, token counting) is structurally declared but needs validation against the actual native dylib. The unit tests pass; integration tests are skipped until `FM_NATIVE=1` is set on a macOS 26+ machine with Apple Intelligence.
- Tool integration in `session.ts` passes the tool count but not yet the bridged FFI tool array. This requires a callback trampoline from Swift back into TypeScript.
- `FMRelease` cleanup of FFI callbacks needs finalization once the JSCallback mechanism is tested end-to-end.

## Reference Materials Used

- `reference/python-apple-fm-sdk/` — primary source being translated
- `reference/foundation-models-c/` — C headers and Swift bindings
- `reference/apple-on-device-ai/` — secondary TypeScript reference (Zod, N-API)
