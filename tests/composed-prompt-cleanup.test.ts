/**
 * Regression tests for composed_prompt lifetime (Python SDK #18).
 *
 * Ensures every respond/stream path releases the FMComposedPrompt pointer,
 * including success, generation error, and compose-time failure paths.
 */
import { describe, it, expect, afterEach } from "bun:test";
import { setNativeBindingsForTests } from "../src/ffi/native.js";
import type { Pointer } from "../src/ffi/types.js";
import { LanguageModelSession } from "../src/session.js";
import { ImageAttachment, composePrompt } from "../src/prompt.js";
import { GenerationErrorCode } from "../src/errors.js";
import { createMockNative } from "./helpers/mock-native.js";

afterEach(() => {
  setNativeBindingsForTests(null);
});

describe("composed_prompt cleanup (Python #18 parity)", () => {
  it("releases composed prompt after successful text respond", async () => {
    const mock = createMockNative();
    let composed: Pointer | null = null;
    mock.composedPromptInitialize = () => {
      composed = mock.nextPtr();
      return composed;
    };
    setNativeBindingsForTests(mock);

    const session = new LanguageModelSession();
    const text = await session.respond("hello");
    expect(text).toBe("ok");
    expect(composed).not.toBeNull();
    expect(mock.releaseCalls).toContain(composed);
  });

  it("releases composed prompt when text respond fails with generation error", async () => {
    const mock = createMockNative();
    let composed: Pointer | null = null;
    mock.composedPromptInitialize = () => {
      composed = mock.nextPtr();
      return composed;
    };
    mock.languageModelSessionRespond = (_s, _p, _o, callback) => {
      queueMicrotask(() => {
        callback(GenerationErrorCode.GUARDRAIL_VIOLATION, null);
      });
      return mock.nextPtr();
    };
    setNativeBindingsForTests(mock);

    const session = new LanguageModelSession();
    await expect(session.respond("blocked")).rejects.toThrow(/Guardrail/i);
    expect(composed).not.toBeNull();
    expect(mock.releaseCalls).toContain(composed);
  });

  it("releases composed prompt after streaming completes", async () => {
    const mock = createMockNative();
    let composed: Pointer | null = null;
    mock.composedPromptInitialize = () => {
      composed = mock.nextPtr();
      return composed;
    };
    setNativeBindingsForTests(mock);

    const session = new LanguageModelSession();
    const chunks: string[] = [];
    for await (const snap of session.streamResponse("stream me")) {
      chunks.push(snap);
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect(composed).not.toBeNull();
    expect(mock.releaseCalls).toContain(composed);
  });

  it("releases composed prompt when stream errors", async () => {
    const mock = createMockNative();
    let composed: Pointer | null = null;
    mock.composedPromptInitialize = () => {
      composed = mock.nextPtr();
      return composed;
    };
    mock.languageModelSessionResponseStreamIterate = (_stream, callback) => {
      callback(GenerationErrorCode.RATE_LIMITED, null);
    };
    setNativeBindingsForTests(mock);

    const session = new LanguageModelSession();
    await expect(async () => {
      for await (const _ of session.streamResponse("stream fail")) {
        // drain
      }
    }).toThrow(/rate limited/i);
    expect(composed).not.toBeNull();
    expect(mock.releaseCalls).toContain(composed);
  });

  it("releases partially built composed prompt when attachment fails", () => {
    const mock = createMockNative();
    let composed: Pointer | null = null;
    mock.composedPromptInitialize = () => {
      composed = mock.nextPtr();
      return composed;
    };
    mock.composedPromptAddAttachment = () => false;
    setNativeBindingsForTests(mock);

    expect(() =>
      composePrompt(["describe", new ImageAttachment("/tmp/missing.png")]),
    ).toThrow(/image attachment/i);
    expect(composed).not.toBeNull();
    expect(mock.releaseCalls).toContain(composed);
  });

  it("releases composed prompt when structured respond rejects", async () => {
    const mock = createMockNative();
    let composed: Pointer | null = null;
    mock.composedPromptInitialize = () => {
      composed = mock.nextPtr();
      return composed;
    };
    mock.languageModelSessionRespondWithSchema = (_s, _p, _schema, _o, callback) => {
      queueMicrotask(() => {
        callback(GenerationErrorCode.DECODING_FAILURE, null);
      });
      return mock.nextPtr();
    };
    setNativeBindingsForTests(mock);

    const { GenerationSchema } = await import("../src/generation-schema.js");
    // Build a schema without relying on real FFI property wiring beyond create/add.
    const schema = new GenerationSchema("T", {}, new Map(), [], "T");

    const session = new LanguageModelSession();
    await expect(
      session.respond("structured", { generating: schema }),
    ).rejects.toThrow(/decode/i);
    expect(composed).not.toBeNull();
    expect(mock.releaseCalls).toContain(composed);
  });
});
