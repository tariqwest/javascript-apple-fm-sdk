# Upstream pin

This SDK tracks Apple’s Python Foundation Models SDK and its in-tree
`foundation-models-c` C ABI.

| Field | Value |
|-------|--------|
| Repository | https://github.com/apple/python-apple-fm-sdk |
| Compatible with | **v0.2.2** |
| Commit | `618da8f1256c6d8008573aacb29705db86c1b11f` |
| Tag | `v0.2.2` |
| Submodule path | `reference/python-apple-fm-sdk` |
| C package path | `reference/python-apple-fm-sdk/foundation-models-c` |

## Setup

```bash
git submodule update --init --recursive
bun install
bun run verify:headers   # ensure C header symbols match the baseline
bun run build:all        # Swift dylib + N-API + tsc (macOS 26+)
```

## Bumping the pin

1. Update the submodule to the desired commit/tag.
2. Run `bun run verify:headers`.
3. If the header gained symbols the SDK needs, extend
   `scripts/foundation-models-required-symbols.txt` and the Rust N-API layer.
4. Rebuild native artifacts and run `FM_NATIVE=1 bun run test`.
5. Update this file’s commit/tag fields and the “Compatible with” notes in
   `README.md` / `AGENTS.md`.
