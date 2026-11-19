/**
 * Lightweight NativeBindings mock for unit tests (no dylib).
 */
import type { NativeBindings } from "../../src/ffi/native.js";
import type { Pointer } from "../../src/ffi/types.js";
import { GenerationErrorCode } from "../../src/errors.js";

export type MockNative = NativeBindings & {
  releaseCalls: Pointer[];
  retainCalls: Pointer[];
  nextPtr: () => Pointer;
};

export function createMockNative(overrides: Partial<NativeBindings> = {}): MockNative {
  let seq = 0x1000;
  const releaseCalls: Pointer[] = [];
  const retainCalls: Pointer[] = [];

  const nextPtr = (): Pointer => {
    seq += 1;
    return seq as Pointer;
  };

  const base: NativeBindings = {
    systemLanguageModelGetDefault: () => nextPtr(),
    systemLanguageModelCreate: () => nextPtr(),
    systemLanguageModelIsAvailable: () => ({ available: true }),
    systemLanguageModelGetContextSize: () => 4096,
    systemLanguageModelGetVariantDisplayName: () => null,

    languageModelSessionCreateDefault: () => nextPtr(),
    languageModelSessionCreateFromSystemLanguageModel: () => nextPtr(),
    languageModelSessionCreateFromTranscript: () => nextPtr(),
    languageModelSessionIsResponding: () => false,
    languageModelSessionReset: () => {},

    composedPromptInitialize: () => nextPtr(),
    composedPromptAddText: () => {},
    composedPromptAddAttachment: () => true,

    languageModelSessionRespond: (_session, _prompt, _opts, callback) => {
      queueMicrotask(() => {
        callback(GenerationErrorCode.SUCCESS, "ok");
        callback(GenerationErrorCode.SUCCESS, null);
      });
      return nextPtr();
    },
    languageModelSessionStreamResponse: () => nextPtr(),
    languageModelSessionResponseStreamIterate: (_stream, callback) => {
      callback(GenerationErrorCode.SUCCESS, "chunk");
      callback(GenerationErrorCode.SUCCESS, null);
    },

    languageModelSessionRespondWithSchema: (_s, _p, _schema, _o, callback) => {
      queueMicrotask(() => {
        // Success without content pointer exercises error path unless overridden.
        callback(GenerationErrorCode.SUCCESS, null);
      });
      return nextPtr();
    },
    languageModelSessionRespondWithSchemaFromJSON: (_s, _p, _json, _o, callback) => {
      queueMicrotask(() => {
        callback(GenerationErrorCode.SUCCESS, null);
      });
      return nextPtr();
    },

    systemLanguageModelTokenCountForPrompt: (_m, _p, cb) => {
      queueMicrotask(() => cb(GenerationErrorCode.SUCCESS, 1));
      return nextPtr();
    },
    systemLanguageModelTokenCountForInstructions: (_m, _i, cb) => {
      queueMicrotask(() => cb(GenerationErrorCode.SUCCESS, 1));
      return nextPtr();
    },
    systemLanguageModelTokenCountForTools: (_m, _t, cb) => {
      queueMicrotask(() => cb(GenerationErrorCode.SUCCESS, 1));
      return nextPtr();
    },
    systemLanguageModelTokenCountForSchema: (_m, _s, cb) => {
      queueMicrotask(() => cb(GenerationErrorCode.SUCCESS, 1));
      return nextPtr();
    },
    systemLanguageModelTokenCountForTranscript: (_m, _t, cb) => {
      queueMicrotask(() => cb(GenerationErrorCode.SUCCESS, 1));
      return nextPtr();
    },

    transcriptCreateFromJSONString: () => nextPtr(),
    languageModelSessionGetTranscriptJSONString: () =>
      JSON.stringify({ transcript: { entries: [] } }),

    generationSchemaCreate: () => nextPtr(),
    generationSchemaPropertyCreate: () => nextPtr(),
    generationSchemaPropertyAddRangeGuide: () => {},
    generationSchemaPropertyAddMinimumGuide: () => {},
    generationSchemaPropertyAddMaximumGuide: () => {},
    generationSchemaPropertyAddCountGuide: () => {},
    generationSchemaPropertyAddMinItemsGuide: () => {},
    generationSchemaPropertyAddMaxItemsGuide: () => {},
    generationSchemaPropertyAddRegex: () => {},
    generationSchemaPropertyAddAnyOfGuide: () => {},
    generationSchemaAddProperty: () => {},
    generationSchemaAddReferenceSchema: () => {},
    generationSchemaGetJSONString: () => "{}",

    generatedContentCreateFromJSON: () => nextPtr(),
    generatedContentGetJSONString: () => "{}",
    generatedContentIsComplete: () => true,

    bridgedToolCreate: () => nextPtr(),
    bridgedToolFinishCall: () => {},
    bridgedToolDestroy: () => {},

    fmRetain: (ptr) => {
      retainCalls.push(ptr);
    },
    fmRelease: (ptr) => {
      releaseCalls.push(ptr);
    },
    fmFreeString: () => {},
    fmTaskCancel: () => {},
  };

  return Object.assign(base, overrides, {
    releaseCalls,
    retainCalls,
    nextPtr,
  });
}
