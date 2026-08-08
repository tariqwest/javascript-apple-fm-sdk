# Foundation Models SDK for JavaScript & TypeScript

JavaScript and TypeScript bindings for Apple's [Foundation Models framework](https://developer.apple.com/documentation/foundationmodels), providing access to the on-device foundation model at the core of Apple Intelligence on macOS.

This SDK is a near 1-to-1 translation of Apple's [Python Foundation Models SDK](https://github.com/apple/python-apple-fm-sdk), adapted for modern JS runtimes (**Bun** and **Node.js**).

- **TypeScript** is first-class (source is `.ts`, published types in `dist/`).
- **JavaScript** consumers import the same package from npm (compiled ESM in `dist/`).
- **Node without a prior `tsc` build:** run TypeScript sources directly with [tsx](https://tsx.is/) (`bun run start:node`, `bun run example:node`).
- **Bun** is the primary dev toolchain for install, test, and native builds.

## Overview

The SDK provides a typed, async interface to Apple's Foundation Models framework from JavaScript or TypeScript.

You can:

- **Evaluate Swift Foundation Models app features** by running batch inference and analyzing results from JS/TS
- Perform **on-device inference** with the system foundation model
- Stream **real-time text generation** responses
- Use **guided generation** with structured output schemas and Zod constraints
- Get **type-safe responses** in TypeScript by defining generation schemas with Zod (plain JS works too—you just won't get compile-time types)
- Configure **custom model settings** for different model options and generation parameters
- Define **tools** the model can call during a conversation
- Process **transcripts exported from Swift apps** for quality analysis

Keep in mind that it's your responsibility to design AI experiences with care.
To learn about practical strategies you can implement in code, **check out:**
[Improving the safety of generative model output](https://developer.apple.com/documentation/foundationmodels/improving-the-safety-of-generative-model-output)
and Apple's [Human Interface Guidelines on Generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai).

## Projects built on this SDK

Higher-level tools that depend on `javascript-apple-fm-sdk` for in-process on-device inference:

- [**fm-server**](https://github.com/tariqwest/fm-server) — OpenAI-compatible HTTP server and CLI for Apple Intelligence. The **system** backend uses this SDK in-process (N-API / Foundation Models); the **pcc** backend pairs with [`fm-access-pcc`](https://github.com/tariqwest/fm-access-PCC).
- [**fm-acp**](https://github.com/tariqwest/fm-acp) — [Agent Client Protocol](https://agentclientprotocol.com/) stdio adapter for Apple Foundation Models (routes through `fm serve` / related backends).

## Sibling projects (used alongside)

These are not replacements for this library; they are commonly combined with it in the same stack:

- [**fm-access-pcc**](https://github.com/tariqwest/fm-access-PCC) — TypeScript library/REST access to Foundation Models including **Private Cloud Compute (PCC)** paths; used with `fm-server` when you need PCC in addition to the on-device system model this SDK drives.
- [**Foundation-Models-Framework-CLI (`afm`)**](https://github.com/rudrankriyam/Foundation-Models-Framework-CLI) — Swift CLI with `afm serve`, schema/tool helpers, and workbench; useful next to this SDK for CLI workflows or an alternate local OpenAI-compatible endpoint.
- [**FoundationModelsKit**](https://github.com/rryam/FoundationModelsKit) — Swift kit underlying much of the `afm` tooling stack.

For broader ecosystem links (upstream Python SDK, prior TS experiments, etc.), see [Reference & Inspiration](#reference--inspiration).

## Requirements

- macOS 26.0+
- Download [Xcode 26.0+](https://developer.apple.com/xcode/) and agree to the [Xcode and Apple SDKs agreement](https://www.apple.com/legal/sla/docs/xcode.pdf) in the Xcode app (needed to build native artifacts from source).
- [Bun](https://bun.sh/) 1.0+ **or** [Node.js](https://nodejs.org/) 18+ (with [tsx](https://tsx.is/) if you want to run `.ts` sources without compiling)
- Apple Intelligence turned on for [a compatible Mac](https://support.apple.com/en-us/121115)

## Installation

```bash
npm install javascript-apple-fm-sdk
# or
pnpm add javascript-apple-fm-sdk
# or
bun add javascript-apple-fm-sdk
```

The published package ships prebuilt native artifacts for **macOS arm64** (`build/libFoundationModels.dylib` and `build/apple_fm_sdk_napi.node`) plus compiled JS and `.d.ts` types under `dist/`. No postinstall build step is required on supported platforms.

> **Platform support:** macOS 26+ on Apple Silicon only. The package declares `os: ["darwin"]` and `cpu: ["arm64"]` so npm will warn on unsupported platforms.

### Runtime choices

| Use case | How |
|----------|-----|
| App / library dependency (JS or TS) | `import fm from 'javascript-apple-fm-sdk'` — uses published `dist/` |
| Bun (dev or prod) | Same import; Bun runs the package natively |
| Node + published package | Same import under Node 18+ (loads the N-API `.node` addon) |
| Node + local TypeScript sources (no `tsc`) | `npx tsx path/to/file.ts` or repo scripts `bun run start:node` / `bun run example:node` |
| Bun + local TypeScript sources | `bun run src/...` or `bun run start` / `bun run example` |

To install from source or contribute, see [Development Installation](#development-installation) below.

## Compatible upstream

This release targets Apple’s [python-apple-fm-sdk](https://github.com/apple/python-apple-fm-sdk) **v0.2.1** plus commit `e868e60811aa0706feb2ccb33cfe7e27626287b7` (composed_prompt cleanup, PR #18). The C ABI comes from the vendored submodule at `reference/python-apple-fm-sdk/foundation-models-c`. See [reference/UPSTREAM.md](reference/UPSTREAM.md).

## Documentation

- [Python SDK documentation](https://apple.github.io/python-apple-fm-sdk/) (the JS/TS API follows the same structure)
- [Python code examples](https://github.com/apple/python-apple-fm-sdk/tree/main/examples) (concepts translate directly to JavaScript/TypeScript)

Examples below are written in TypeScript. They run as-is under Bun or Node+tsx, and the same API is available from plain JavaScript via the published package.

## Basic usage

```typescript
import fm from 'javascript-apple-fm-sdk';

async function main() {
    // Get the default system foundation model
    const model = new fm.SystemLanguageModel();

    // Check if the model is available
    const [isAvailable, reason] = model.isAvailable();
    if (isAvailable) {
        // Create a session
        const session = new fm.LanguageModelSession();

        // Generate a response
        const response = await session.respond("Hello, how are you?");
        console.log(`Model response: ${response}`);
    } else {
        console.log(`Foundation Models not available: ${reason}`);
    }
}

await main();
```

### Streaming responses

> **Note:** `streamResponse` yields **cumulative snapshots** (the full response generated so far), not deltas. To print incrementally, slice off the portion you have already seen.

```typescript
import fm from 'javascript-apple-fm-sdk';

const model = new fm.SystemLanguageModel();
const [isAvailable] = model.isAvailable();

if (isAvailable) {
    const session = new fm.LanguageModelSession();
    let previous = "";
    for await (const snapshot of session.streamResponse("Tell me a short story about a cat")) {
        const delta = snapshot.slice(previous.length);
        process.stdout.write(delta);
        previous = snapshot;
    }
}
```

### Guided generation

The SDK uses [Zod](https://zod.dev/) schemas and the `guide()` helper to define generation constraints. This is equivalent to the Python SDK's `@generable` decorator and `fm.guide()`. In TypeScript you get inferred types from Zod; in JavaScript you use the same runtime API without static types.

```typescript
import fm from 'javascript-apple-fm-sdk';
import z from "zod";

const Cat = fm.generable(
    z.object({
        name: z.string(),
        age: fm.guide(z.number().int(), { description: "Age in years", range: [0, 20] }),
    }),
    "Cat",
);

async function generateCat() {
    const model = new fm.SystemLanguageModel();
    const [isAvailable, reason] = model.isAvailable();

    if (isAvailable) {
        const session = new fm.LanguageModelSession();

        // Generate a response typed as Cat
        const cat = await session.respond("Generate an adorable rescue cat", {
            generating: Cat.generationSchema(),
        });

        // The response is a GeneratedContent instance; parse it with the schema
        const parsed = Cat.parse(cat);
        console.log(`Name: ${parsed.name}, Age: ${parsed.age}`);
    } else {
        console.log(`Foundation Models not available: ${reason}`);
    }
}

await generateCat();
```

### Tools

Define tools by extending the `Tool` class. The model can invoke them during a conversation.

```typescript
import fm from 'javascript-apple-fm-sdk';
import z from "zod";

const WeatherParams = fm.generable(
    z.object({
        location: z.string(),
    }),
    "Weather parameters",
);

class WeatherTool extends fm.Tool {
    name = "WeatherTool";
    description = "Gets the current weather for a location.";

    get argumentsSchema() {
        return WeatherParams.generationSchema();
    }

    async call(args: fm.GeneratedContent) {
        const location = args.value<string>("location");
        return `72°F in ${location}`;
    }
}

const model = new fm.SystemLanguageModel();
const [isAvailable] = model.isAvailable();

if (isAvailable) {
    const session = new fm.LanguageModelSession({
        instructions: "You can use the WeatherTool to check the weather.",
        tools: [new WeatherTool()],
    });

    const response = await session.respond("What is the weather in Taipei?");
    console.log(response);
}
```

### Generation options

```typescript
import fm from 'javascript-apple-fm-sdk';

const options = new fm.GenerationOptions({
    temperature: 0.7,
    sampling: fm.SamplingMode.random({ top: 50, seed: 42 }),
    maximumResponseTokens: 200,
});

const session = new fm.LanguageModelSession();
const response = await session.respond("Write a haiku.", { options });
```

### Transcripts

Export a session's conversation history and restore it later.

```typescript
const session = new fm.LanguageModelSession();
await session.respond("My name is Alice.");
await session.respond("What is my name?");

const transcript = new fm.Transcript(session.ptr);
const dict = await transcript.toDict();

// Restore the conversation from the transcript
const restored = await fm.Transcript.fromDict(dict);
```

### Custom model configuration

```typescript
const model = new fm.SystemLanguageModel({
    useCase: fm.SystemLanguageModelUseCase.CONTENT_TAGGING,
    guardrails: fm.SystemLanguageModelGuardrails.PERMISSIVE_CONTENT_TRANSFORMATIONS,
});

console.log(`Context size: ${model.getContextSize()}`);
```

## Development Installation

If you need to modify the SDK or install from source:

1. Get the code

```bash
git clone https://github.com/tariqwest/javascript-apple-fm-sdk
cd javascript-apple-fm-sdk
```

2. Initialize the upstream submodule, install dependencies, and build native bits

```bash
git submodule update --init --recursive
bun install
bun run verify:headers
bun run build:all
```

This compiles the Swift `foundation-models-c` dylib, the Rust N-API addon, and (via `tsc`) the published `dist/` JS + types. **You do not need `tsc` just to try the SDK from this repo**—see step 5.

3. Run the test suite (Bun’s built-in test runner)

```bash
bun run test
```

To run tests that exercise the native FFI layer (requires a macOS 26+ machine with Apple Intelligence enabled):

```bash
FM_NATIVE=1 bun run test
```

4. Type-check the project

```bash
bun run check
```

5. Run TypeScript sources without compiling

Bun executes `.ts` directly. On Node, use **tsx** (devDependency) the same way—no `dist/` emit required:

```bash
bun run start          # Bun → src/entry.ts
bun run start:node     # Node + tsx → src/entry.ts
bun run example        # Bun → examples/simple-inference.ts
bun run example:node   # Node + tsx → examples/simple-inference.ts

# or ad hoc:
npx tsx examples/streaming.ts
npx tsx src/entry.ts
```

6. Optional: emit `dist/` for a local Node consumer that imports the package like npm would

```bash
bun run build          # tsc only (native artifacts already built above)
node --input-type=module -e "import fm from './dist/index.js'; console.log(fm.isNativeAvailable())"
```

**Toolchain summary:** Bun is primary for install, test, and native builds. Node is fully supported at runtime via the N-API addon. For day-to-day JS/TS development against this repo, prefer Bun or **Node + tsx** so you are not blocked on `tsc`.

## Key Differences from the Python SDK

- **Runtime**: Runs on both [Bun](https://bun.sh/) and [Node.js](https://nodejs.org/) via the Rust N-API addon in `native/` (built with `bun run build:napi`). Both load the same `.node` artifact through the `NativeBindings` abstraction. Local TypeScript can be executed with Bun or Node+tsx without a separate compile step.
- **Language**: Implemented in TypeScript; published as ESM JavaScript + declaration files. Plain JavaScript projects consume the npm package normally.
- **Generables**: Python uses a `@fm.generable` class decorator; JS/TS uses a `fm.generable(zodSchema)` factory function.
- **Schema constraints**: Python uses `fm.guide("description", range=(0, 20))`; JS/TS uses `fm.guide(z.number(), { description: "Age in years", range: [0, 20] })`.
- **Tool return values**: Tools in both SDKs return strings that are passed back to the model.

## Contributing

This project is not yet taking contributions. Stay tuned!

## Reference & Inspiration

Projects and docs that informed this SDK (API parity, native ABI, tooling, or adjacent ecosystem):

### Upstream & ABI

- [apple/python-apple-fm-sdk](https://github.com/apple/python-apple-fm-sdk) — primary API source of truth (vendored as `reference/python-apple-fm-sdk`)
- [foundation-models-c](https://github.com/apple/python-apple-fm-sdk/tree/main/foundation-models-c) — C bindings / dylib ABI used by this package’s N-API layer
- [Apple Foundation Models documentation](https://developer.apple.com/documentation/foundationmodels) — system framework docs
- [Improving the safety of generative model output](https://developer.apple.com/documentation/foundationmodels/improving-the-safety-of-generative-model-output)
- [HIG: Generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai)

### Overlapping tooling & kits

- [rudrankriyam/Foundation-Models-Framework-CLI](https://github.com/rudrankriyam/Foundation-Models-Framework-CLI) (`afm`) — Swift CLI, OpenAI-compatible `afm serve`, schema/tool helpers, workbench
- [rryam/FoundationModelsKit](https://github.com/rryam/FoundationModelsKit) — Swift kit used by the `afm` CLI stack
- [meridius-labs/apple-on-device-ai](https://github.com/meridius-labs/apple-on-device-ai) — prior Bun/Node bindings and Vercel AI SDK-oriented patterns
- [anthropics/ClaudeForFoundationModels](https://github.com/anthropics/ClaudeForFoundationModels) — Claude on Apple Foundation Models infrastructure (adjacent product)

### Other JS/TS & community explorations

- [Arthur-Ficial/apfel](https://github.com/Arthur-Ficial/apfel)
- [codybrom/tsfm](https://github.com/codybrom/tsfm)
- [tariqwest/apfel-plus](https://github.com/tariqwest/apfel-plus)
- [tariqwest/afm-js](https://github.com/tariqwest/afm-js)

Pin details for the Python SDK / `foundation-models-c` revision we track: [reference/UPSTREAM.md](reference/UPSTREAM.md).


## Publishing

Maintainers can prepare a release tarball with:

```bash
bun run build:release                    # headers + native + tsc + package verify
npm pack --dry-run --ignore-scripts      # preview the tarball
```

To publish (requires [GitHub CLI](https://cli.github.com/) via `gh auth login` and `npm login`):

```bash
./scripts/release.sh current --yes   # first publish of package.json version
./scripts/release.sh patch --yes     # bump patch, npm publish, tag, GitHub release
```

This publishes to npm (unless `--github-only`), pushes the git tag, and creates a [GitHub Release](https://github.com/tariqwest/javascript-apple-fm-sdk/releases) with the npm tarball attached.

## License

MIT — see [LICENSE](LICENSE).
