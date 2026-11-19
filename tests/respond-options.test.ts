import { afterEach, describe, expect, it } from "bun:test";
import { setNativeBindingsForTests } from "../src/ffi/native.js";
import { GenerationOptions, SamplingMode } from "../src/generation-options.js";
import { GenerationSchema } from "../src/generation-schema.js";
import { LanguageModelSession } from "../src/session.js";
import { GenerationErrorCode } from "../src/errors.js";
import { createMockNative } from "./helpers/mock-native.js";

afterEach(() => setNativeBindingsForTests(null));

describe("response generation options", () => {
  it("forwards identical options to plain and structured generation", async () => {
    const mock = createMockNative();
    const received: Array<string | null> = [];
    mock.languageModelSessionRespond = (_session, _prompt, options, callback) => {
      received.push(options);
      queueMicrotask(() => {
        callback(GenerationErrorCode.SUCCESS, "ok");
        callback(GenerationErrorCode.SUCCESS, null);
      });
      return mock.nextPtr();
    };
    mock.languageModelSessionRespondWithSchema = (_session, _prompt, _schema, options, callback) => {
      received.push(options);
      queueMicrotask(() => callback(GenerationErrorCode.SUCCESS, mock.nextPtr()));
      return mock.nextPtr();
    };
    setNativeBindingsForTests(mock);
    const session = new LanguageModelSession();
    const schema = new GenerationSchema("Result", {}, new Map(), []);
    const options = new GenerationOptions({ sampling: SamplingMode.random({ top: 5, seed: 42 }), temperature: 0.5, maximumResponseTokens: 30 });
    await session.respond("hello", { options });
    await session.respond("hello", { options, generating: schema });
    expect(received).toEqual([JSON.stringify(options.toJSON()), JSON.stringify(options.toJSON())]);
    schema.release();
    session.release();
  });
});
