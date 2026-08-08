/**
 * Multi-turn chat REPL with transcript export/restore.
 *
 * Commands:
 *   /quit              exit
 *   /reset             clear session history
 *   /save <path>       write transcript JSON
 *   /load <path>       restore session from transcript JSON
 *
 *   bun run examples/chat-repl.ts
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import {
  SystemLanguageModel,
  LanguageModelSession,
  Transcript,
} from "../src/index.js";
import { isMainModule } from "../src/is-main.js";

async function main(): Promise<void> {
  const model = new SystemLanguageModel();
  const [available, reason] = model.isAvailable();
  if (!available) {
    console.log(`Model not available: ${reason}`);
    process.exitCode = 1;
    return;
  }

  let session = new LanguageModelSession({
    instructions: "You are a helpful on-device assistant. Keep replies short.",
  });

  const rl = createInterface({ input, output });
  console.log("Chat REPL. Commands: /quit /reset /save <path> /load <path>");

  try {
    while (true) {
      const line = (await rl.question("you> ")).trim();
      if (!line) continue;

      if (line === "/quit" || line === "/exit") break;

      if (line === "/reset") {
        session.reset();
        console.log("(session reset)");
        continue;
      }

      if (line.startsWith("/save ")) {
        const path = line.slice("/save ".length).trim();
        const transcript = new Transcript(session.ptr);
        const dict = await transcript.toDict();
        await writeFile(path, JSON.stringify(dict, null, 2), "utf8");
        console.log(`(saved transcript → ${path})`);
        continue;
      }

      if (line.startsWith("/load ")) {
        const path = line.slice("/load ".length).trim();
        const raw = JSON.parse(await readFile(path, "utf8")) as Record<
          string,
          unknown
        >;
        const restored = await Transcript.fromDict(raw);
        session = LanguageModelSession.fromTranscript(restored, { model });
        console.log(`(loaded transcript ← ${path})`);
        continue;
      }

      const response = await session.respond(line);
      console.log(`assistant> ${String(response)}\n`);
    }
  } finally {
    rl.close();
    session.release();
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { main };
