/**
 * P1 parity tests: image prompts, JSON guided generation edge cases,
 * and generable protocol behavior (without requiring FM_NATIVE).
 */
import { describe, it, expect, afterEach } from "bun:test";
import z from "zod";
import {
  setNativeBindingsForTests,
} from "../src/ffi/native.js";
import {
  Attachment,
  ImageAttachment,
  ImagePromptError,
  PromptError,
  composePrompt,
} from "../src/prompt.js";
import { generable, GeneratedContent } from "../src/generable.js";
import { guide } from "../src/generation-guide.js";
import { createMockNative } from "./helpers/mock-native.js";

afterEach(() => {
  setNativeBindingsForTests(null);
});

describe("image prompts", () => {
  it("ImageAttachment stores path and optional label", () => {
    const a = new ImageAttachment("/tmp/cat.png", "a cat");
    expect(a.path).toBe("/tmp/cat.png");
    expect(a.label).toBe("a cat");
    expect(a).toBeInstanceOf(Attachment);
  });

  it("composePrompt adds text then image attachment via FFI", () => {
    const mock = createMockNative();
    const calls: Array<{ path: string; label: string | null }> = [];
    mock.composedPromptAddAttachment = (_p, path, label) => {
      calls.push({ path, label });
      return true;
    };
    const texts: string[] = [];
    mock.composedPromptAddText = (_p, text) => {
      texts.push(text);
    };
    setNativeBindingsForTests(mock);

    const ptr = composePrompt([
      "What is in this image?",
      new ImageAttachment("/tmp/photo.jpg", "photo"),
    ]);
    expect(ptr).toBeTruthy();
    expect(texts).toEqual(["What is in this image?"]);
    expect(calls).toEqual([{ path: "/tmp/photo.jpg", label: "photo" }]);
  });

  it("maps failed attachment add to ImagePromptError", () => {
    const mock = createMockNative();
    mock.composedPromptAddAttachment = () => false;
    setNativeBindingsForTests(mock);

    expect(() => composePrompt(new ImageAttachment("/nope.png"))).toThrow(
      ImagePromptError,
    );
  });

  it("rejects invalid prompt component types", () => {
    const mock = createMockNative();
    setNativeBindingsForTests(mock);
    expect(() => composePrompt(42 as unknown as string)).toThrow(PromptError);
  });
});

describe("JSON guided generation edge cases", () => {
  const Product = generable(
    z.object({
      name: z.string(),
      price: guide(z.number(), { range: [0, 1000] }),
      tags: guide(z.array(z.string()), { minItems: 1, maxItems: 5 }),
    }),
    "Product",
  );

  it("parses valid GeneratedContent JSON", () => {
    const content = GeneratedContent.fromJSON(
      JSON.stringify({
        name: "Mug",
        price: 12.5,
        tags: ["kitchen"],
      }),
    );
    const product = Product.parse(content);
    expect(product.name).toBe("Mug");
    expect(product.price).toBe(12.5);
    expect(product.tags).toEqual(["kitchen"]);
  });

  it("rejects missing required fields", () => {
    const content = GeneratedContent.fromJSON(JSON.stringify({ name: "Mug" }));
    expect(() => Product.parse(content)).toThrow();
  });

  it("rejects wrong JSON types", () => {
    const content = GeneratedContent.fromJSON(
      JSON.stringify({ name: "Mug", price: "free", tags: [] }),
    );
    expect(() => Product.parse(content)).toThrow();
  });

  it("round-trips contentDict through toJSON", () => {
    const content = new GeneratedContent({
      name: "Lamp",
      price: 40,
      tags: ["home"],
    });
    const again = GeneratedContent.fromJSON(content.toJSON());
    expect(Product.parse(again).name).toBe("Lamp");
  });
});

describe("generable protocol", () => {
  it("exposes name, description, zodSchema, generationSchema, parse", () => {
    const Schema = generable(
      z.object({
        ok: z.boolean(),
      }),
      "Flag",
    );

    expect(Schema.name).toBe("Flag");
    expect(Schema.description).toBe("Flag");
    expect(Schema.zodSchema).toBeDefined();
    expect(typeof Schema.generationSchema).toBe("function");
    expect(typeof Schema.parse).toBe("function");

    const mock = createMockNative();
    setNativeBindingsForTests(mock);
    const gs = Schema.generationSchema();
    expect(gs).toBeDefined();
    // Cached
    expect(Schema.generationSchema()).toBe(gs);
  });

  it("parse accepts GeneratedContent and returns typed object", () => {
    const Person = generable(
      z.object({
        first: z.string(),
        age: z.number().int(),
      }),
      "Person",
    );
    const parsed = Person.parse(
      new GeneratedContent({ first: "Ada", age: 36 }),
    );
    expect(parsed.first).toBe("Ada");
    expect(parsed.age).toBe(36);
  });
});
