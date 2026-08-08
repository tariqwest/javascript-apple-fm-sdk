/**
 * Token budget example
 *
 * Compare tokenCount() inputs against getContextSize() before calling respond().
 *
 *   bun run examples/token-budget.ts
 */
import {
  SystemLanguageModel,
  LanguageModelSession,
  GenerationOptions,
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

  const contextSize = model.getContextSize();
  const instructions =
    "You are a concise assistant. Prefer short answers under 40 words.";
  const prompt =
    "Summarize the purpose of on-device foundation models in one paragraph.";

  const instructionTokens = await model.tokenCount(undefined, { instructions });
  const promptTokens = await model.tokenCount(prompt);
  const reservedResponse = 128;
  const projected = instructionTokens + promptTokens + reservedResponse;
  const remaining = contextSize - projected;

  console.log("=== Token budget ===");
  console.log(`context size:          ${contextSize}`);
  console.log(`instructions tokens:   ${instructionTokens}`);
  console.log(`prompt tokens:         ${promptTokens}`);
  console.log(`reserved for response: ${reservedResponse}`);
  console.log(`projected total:       ${projected}`);
  console.log(`remaining headroom:    ${remaining}`);

  if (remaining < 0) {
    console.error("Projected usage exceeds context window; shorten the prompt.");
    process.exitCode = 1;
    return;
  }

  const session = new LanguageModelSession({ instructions });
  const response = await session.respond(prompt, {
    options: new GenerationOptions({ maximumResponseTokens: reservedResponse }),
  });
  console.log("\n=== Response ===");
  console.log(String(response));
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { main };
