import { afterEach, describe, expect, it } from "bun:test";
import { setNativeBindingsForTests } from "../src/ffi/native.js";
import { GeneratedContent } from "../src/generable.js";
import { createMockNative } from "./helpers/mock-native.js";

afterEach(() => setNativeBindingsForTests(null));

describe("generated content native lifecycle", () => {
  it("preserves completeness after releasing the native pointer", () => {
    const mock = createMockNative();
    mock.generatedContentIsComplete = () => false;
    mock.generatedContentGetJSONString = () => '{"value":"partial"}';
    setNativeBindingsForTests(mock);
    const ptr = mock.nextPtr();
    const content = new GeneratedContent(undefined, undefined, ptr);
    expect(content.isComplete).toBe(false);
    expect(content.contentDict).toEqual({ value: "partial" });
    expect(mock.releaseCalls).toEqual([ptr]);
  });

  it("releases the pointer if JSON parsing fails", () => {
    const mock = createMockNative();
    mock.generatedContentGetJSONString = () => "invalid JSON";
    setNativeBindingsForTests(mock);
    const ptr = mock.nextPtr();
    expect(() => new GeneratedContent(undefined, undefined, ptr)).toThrow();
    expect(mock.releaseCalls).toEqual([ptr]);
  });
});
