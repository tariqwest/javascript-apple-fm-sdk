/**
 * Detect whether a module is the process entrypoint under Bun, Node, or tsx.
 */
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function isMainModule(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;

  try {
    const modulePath = fileURLToPath(importMetaUrl);
    const entryPath = resolve(entry);
    if (modulePath === entryPath) return true;
    return importMetaUrl === pathToFileURL(entryPath).href;
  } catch {
    return false;
  }
}
