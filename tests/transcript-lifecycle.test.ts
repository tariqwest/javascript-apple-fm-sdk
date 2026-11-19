import { afterEach, describe, expect, it } from "bun:test";
import { setNativeBindingsForTests } from "../src/ffi/native.js";
import { LanguageModelSession } from "../src/session.js";
import { Transcript } from "../src/transcript.js";
import { createMockNative } from "./helpers/mock-native.js";

afterEach(() => setNativeBindingsForTests(null));

describe("session transcript restoration", () => {
  it("restores a working session and preserves the transcript owner", async () => {
    const mock = createMockNative();
    const transcriptPtr = mock.nextPtr();
    const restoredPtr = mock.nextPtr();
    mock.transcriptCreateFromJSONString = () => transcriptPtr;
    mock.languageModelSessionCreateFromTranscript = (ptr) => {
      expect(ptr).toBe(transcriptPtr);
      return restoredPtr;
    };
    mock.languageModelSessionGetTranscriptJSONString = () => '{"entries":[]}';
    setNativeBindingsForTests(mock);
    const transcript = await Transcript.fromDict({ entries: [] });
    const session = LanguageModelSession.fromTranscript(transcript);
    expect(session.ptr).toBe(restoredPtr);
    expect(await session.transcript.toDict()).toEqual({ entries: [] });
    expect(await session.respond("hello")).toBe("ok");
    const view = session.transcript;
    session.release();
    await expect(view.toDict()).rejects.toThrow();
    expect(mock.releaseCalls).toContain(restoredPtr);
  });
});
