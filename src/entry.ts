/**
 * Runnable entrypoint for local smoke checks under Bun or Node (via tsx).
 *
 * Bun remains the primary dev toolchain (`bun run test`, `bun run build:*`).
 * Use this entry when you want to exercise the TypeScript sources directly
 * without a prior `tsc` emit:
 *
 *   bun run start
 *   bun run start:node   # tsx → Node
 *
 * Published consumers should import `javascript-apple-fm-sdk` (dist/), not this file.
 */

import {
  SystemLanguageModel,
  SystemLanguageModelUnavailableReason,
  isNativeAvailable,
} from "./index.js";
import { isMainModule } from "./is-main.js";

const UNAVAILABLE_LABELS: Record<number, string> = {
  [SystemLanguageModelUnavailableReason.APPLE_INTELLIGENCE_NOT_ENABLED]:
    "APPLE_INTELLIGENCE_NOT_ENABLED",
  [SystemLanguageModelUnavailableReason.DEVICE_NOT_ELIGIBLE]: "DEVICE_NOT_ELIGIBLE",
  [SystemLanguageModelUnavailableReason.MODEL_NOT_READY]: "MODEL_NOT_READY",
  [SystemLanguageModelUnavailableReason.UNKNOWN]: "UNKNOWN",
};

export async function main(): Promise<void> {
  console.log("javascript-apple-fm-sdk");
  console.log(`  native addon: ${isNativeAvailable() ? "available" : "missing"}`);

  if (!isNativeAvailable()) {
    console.log("  hint: run `bun run build:all` to build foundation-models-c + N-API");
    process.exitCode = 1;
    return;
  }

  const model = new SystemLanguageModel();
  const [available, reason] = model.isAvailable();

  if (!available) {
    const label =
      reason === undefined
        ? "unknown"
        : (UNAVAILABLE_LABELS[reason] ?? String(reason));
    console.log(`  model: unavailable (${label})`);
    process.exitCode = 1;
    return;
  }

  const contextSize = model.getContextSize();
  console.log("  model: available");
  console.log(`  context size: ${contextSize}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
