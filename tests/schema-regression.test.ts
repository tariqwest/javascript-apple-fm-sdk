import { afterEach, describe, expect, it } from "bun:test";
import z from "zod";
import { generable } from "../src/generable.js";
import { guide } from "../src/generation-guide.js";
import { dispatchResponseEvent } from "../src/ffi/events.js";
import { setNativeBindingsForTests } from "../src/ffi/native.js";
import { createMockNative } from "./helpers/mock-native.js";

afterEach(() => setNativeBindingsForTests(null));

describe("schema regressions", () => {
  it("encodes nested objects, optional arrays, and count guides", () => {
    const mock = createMockNative();
    const properties: Array<[string, string, boolean]> = [];
    const counts: boolean[] = [];
    const references: number[] = [];
    mock.generationSchemaPropertyCreate = (name, _description, type, optional) => {
      properties.push([name, type, optional]);
      return mock.nextPtr();
    };
    mock.generationSchemaPropertyAddCountGuide = (_prop, _count, wrapped) => { counts.push(wrapped); };
    mock.generationSchemaAddReferenceSchema = (_schema, reference) => { references.push(reference); };
    setNativeBindingsForTests(mock);
    const schema = generable(z.object({
      profile: z.object({ name: z.string() }),
      friends: guide(z.array(z.object({ name: z.string() })).optional(), { count: 2 }),
    }), "Root").generationSchema();
    expect(properties).toContainEqual(["profile", "Root_profile", false]);
    expect(properties).toContainEqual(["friends", "array<Root_friends>", true]);
    expect(counts).toEqual([false]);
    expect(references).toHaveLength(2);
    schema.release();
  });

  it("preserves native error descriptions", () => {
    let result: unknown[] = [];
    dispatchResponseEvent(JSON.stringify({ type: "error", payload: { status: 255, description: "native detail" } }), (status, text) => { result = [status, text]; });
    expect(result).toEqual([255, "native detail"]);
  });
});
