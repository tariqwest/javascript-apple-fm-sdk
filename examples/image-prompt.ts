/**
 * Image prompt example
 *
 * Compose a multimodal prompt with ImageAttachment (WWDC 2026 / Python SDK v0.2.0+).
 *
 *   bun run examples/image-prompt.ts /path/to/image.png
 *   bun run example:node -- examples/image-prompt.ts /path/to/image.png
 */
import {
  SystemLanguageModel,
  LanguageModelSession,
  ImageAttachment,
} from "../src/index.js";
import { isMainModule } from "../src/is-main.js";

async function main(argv = process.argv.slice(2)): Promise<void> {
  const imagePath = argv[0];
  if (!imagePath) {
    console.error("Usage: image-prompt.ts <path-to-image> [question]");
    process.exitCode = 1;
    return;
  }
  const question = argv[1] ?? "Describe this image briefly.";

  const model = new SystemLanguageModel();
  const [available, reason] = model.isAvailable();
  if (!available) {
    console.log(`Model not available: ${reason}`);
    process.exitCode = 1;
    return;
  }

  const session = new LanguageModelSession({
    instructions: "You describe images clearly and concisely.",
  });

  const response = await session.respond([
    question,
    new ImageAttachment(imagePath, "user image"),
  ]);
  console.log(String(response));
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { main };
