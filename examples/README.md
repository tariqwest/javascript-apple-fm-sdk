# Examples

These examples mirror the Python SDK examples in `reference/python-apple-fm-sdk/examples/` and demonstrate the core capabilities of the TypeScript SDK.

All examples require macOS 26+ with Apple Intelligence enabled, and the native library must be built first.

## Setup

```bash
# Install dependencies
bun install

# Build the FoundationModels C dylib
bun run build:native

# Build the Node.js N-API addon (optional; required for Node.js, bun works without it)
bun run build:napi
```

## Running examples

### Simple inference

```bash
bun run examples/simple-inference.ts
# or with Node.js
bun run example:node
```

### Streaming response

```bash
bun run examples/streaming.ts
# or with Node.js
tsx examples/streaming.ts
```

### Transcript processing

```bash
# Provide a transcript JSON exported from a Swift app
bun run examples/transcript-processing.ts path/to/transcript.json
```

## Example overview

- `simple-inference.ts` — Check model availability, create a session, and have a multi-turn conversation.
- `streaming.ts` — Stream a response from the model chunk by chunk.
- `transcript-processing.ts` — Load a transcript exported from a Swift app, analyze its structure, and restore it into a new session.
- `image-prompt.ts` — Multimodal prompt with `ImageAttachment`.
- `token-budget.ts` — Compare `tokenCount()` against `getContextSize()` before generating.
- `chat-repl.ts` — Interactive multi-turn chat with `/save` and `/load` transcript round-trip.

### Image prompt

```bash
bun run examples/image-prompt.ts /path/to/image.png
```

### Token budget

```bash
bun run examples/token-budget.ts
```

### Chat REPL

```bash
bun run examples/chat-repl.ts
```
