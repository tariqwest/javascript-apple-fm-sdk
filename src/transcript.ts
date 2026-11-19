/**
 * Transcript — read-only access to a session's conversation history.
 *
 * Mirrors the Python SDK's `Transcript` class and the Swift
 * `FoundationModels.Transcript`.
 */

import { getNativeBindings, requirePointer } from "./ffi/native.js";
import { ManagedObject } from "./ffi/managed-object.js";
import type { FMLanguageModelSessionRef } from "./ffi/types.js";
export class Transcript {
  private _sessionPtr: FMLanguageModelSessionRef;

  constructor(sessionPtr: FMLanguageModelSessionRef, private readonly owner?: ManagedObject) {
    this._sessionPtr = sessionPtr;
  }

  /** The underlying session pointer (used by fromTranscript). */
  get sessionPtr(): FMLanguageModelSessionRef {
    return this.owner?.ptr ?? this._sessionPtr;
  }

  /**
   * Export the transcript as a JSON-compatible dictionary.
   */
  async toDict(): Promise<Record<string, unknown>> {
    const native = getNativeBindings();
    const jsonStr = native.languageModelSessionGetTranscriptJSONString(this.sessionPtr);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  }

  /**
   * Create a Transcript from a JSON dictionary.
   */
  static async fromDict(dict: Record<string, unknown>): Promise<Transcript> {
    const native = getNativeBindings();
    const sessionPtr = requirePointer(native.transcriptCreateFromJSONString(JSON.stringify(dict)), "transcriptCreateFromJSONString");
    return new Transcript(sessionPtr, new ManagedObject(sessionPtr));
  }
}
