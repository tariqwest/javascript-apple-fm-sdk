import { describe, it, expect, afterEach } from "bun:test";
import { setNativeBindingsForTests } from "../src/ffi/native.js";
import { createMockNative } from "./helpers/mock-native.js";
import {
  SystemLanguageModel,
  SystemLanguageModelUseCase,
  SystemLanguageModelGuardrails,
  SystemLanguageModelUnavailableReason,
} from "../src/core.js";

afterEach(() => setNativeBindingsForTests(null));

describe("SystemLanguageModel enums", () => {
  it("SystemLanguageModelUseCase has expected values", () => {
    expect(SystemLanguageModelUseCase.GENERAL).toBe(0);
    expect(SystemLanguageModelUseCase.CONTENT_TAGGING).toBe(1);
  });

  it("SystemLanguageModelGuardrails has expected values", () => {
    expect(SystemLanguageModelGuardrails.DEFAULT).toBe(0);
    expect(SystemLanguageModelGuardrails.PERMISSIVE_CONTENT_TRANSFORMATIONS).toBe(1);
  });

  it("SystemLanguageModelUnavailableReason has expected values", () => {
    expect(SystemLanguageModelUnavailableReason.APPLE_INTELLIGENCE_NOT_ENABLED).toBe(0);
    expect(SystemLanguageModelUnavailableReason.DEVICE_NOT_ELIGIBLE).toBe(1);
    expect(SystemLanguageModelUnavailableReason.MODEL_NOT_READY).toBe(2);
    expect(SystemLanguageModelUnavailableReason.UNKNOWN).toBe(0xff);
  });
});

describe("SystemLanguageModel variant", () => {
  it("returns the display name or null when unavailable", () => {
    const mock = createMockNative();
    setNativeBindingsForTests(mock);
    const model = new SystemLanguageModel();
    expect(model.variant).toBeNull();
    mock.systemLanguageModelGetVariantDisplayName = (ptr) => {
      expect(ptr).toBe(model.ptr);
      return "On-device model";
    };
    expect(model.variant).toEqual({ displayName: "On-device model" });
    model.release();
    expect(() => model.variant).toThrow();
  });
});

// Integration tests that require native bindings are in a separate describe
// block so they can be conditionally skipped.
describe.skipIf(!process.env.FM_NATIVE)("SystemLanguageModel (native)", () => {
  it("can be constructed with defaults", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    expect(model).toBeDefined();
  });

  it("isAvailable returns [boolean, reason | undefined]", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const [available, reason] = model.isAvailable();
    expect(typeof available).toBe("boolean");
    if (!available) {
      expect(reason).toBeDefined();
    }
  });

  it("can be constructed with custom use case", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel({
      useCase: SystemLanguageModelUseCase.CONTENT_TAGGING,
    });
    expect(model).toBeDefined();
  });

  it("can be constructed with custom guardrails", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel({
      guardrails: SystemLanguageModelGuardrails.PERMISSIVE_CONTENT_TRANSFORMATIONS,
    });
    expect(model).toBeDefined();
  });

  it("getContextSize returns a positive integer", async () => {
    const { SystemLanguageModel } = await import("../src/core.js");
    const model = new SystemLanguageModel();
    const size = model.getContextSize();
    expect(size).toBeGreaterThan(0);
    expect(Number.isInteger(size)).toBe(true);
  });
});
