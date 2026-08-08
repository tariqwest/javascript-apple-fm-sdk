#!/usr/bin/env node
/**
 * Fail if the pinned foundation-models-c header drifts from the required
 * C symbol baseline used by this SDK's N-API layer.
 *
 * Usage:
 *   node scripts/verify-foundation-models-headers.mjs
 *   bun run verify:headers
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const headerPath = resolve(
  root,
  "reference/python-apple-fm-sdk/foundation-models-c/Sources/FoundationModelsCBindings/include/FoundationModels.h",
);
const requiredPath = resolve(root, "scripts/foundation-models-required-symbols.txt");
const pinPath = resolve(root, "reference/UPSTREAM.md");

function fail(message) {
  console.error(`verify-foundation-models-headers: ${message}`);
  process.exit(1);
}

if (!existsSync(headerPath)) {
  fail(
    `missing header at ${headerPath}\n` +
      `  Run: git submodule update --init --recursive`,
  );
}

if (!existsSync(requiredPath)) {
  fail(`missing required symbol baseline at ${requiredPath}`);
}

const header = readFileSync(headerPath, "utf8");
const headerSymbols = new Set(
  [...header.matchAll(/\b(FM[A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]),
);

const required = readFileSync(requiredPath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

const missing = required.filter((sym) => !headerSymbols.has(sym));
const extras = [...headerSymbols].filter((sym) => !required.includes(sym)).sort();

console.log(`Header: ${headerPath}`);
console.log(`Required symbols: ${required.length}`);
console.log(`Header function symbols: ${headerSymbols.size}`);

if (existsSync(pinPath)) {
  const pin = readFileSync(pinPath, "utf8");
  const commit = pin.match(/Commit:\s*`?([0-9a-f]{7,40})`?/i)?.[1];
  if (commit) console.log(`Documented pin commit: ${commit}`);
}

if (missing.length) {
  console.error("\nMissing required symbols (SDK expects these from the pin):");
  for (const sym of missing) console.error(`  - ${sym}`);
  fail("header is missing required symbols — update N-API bindings or the pin");
}

if (extras.length) {
  console.log("\nNew header symbols not in baseline (informational):");
  for (const sym of extras) console.log(`  + ${sym}`);
  console.log(
    "If these are needed by the SDK, add them to scripts/foundation-models-required-symbols.txt and wire N-API bindings.",
  );
}

console.log("\nOK: required foundation-models-c symbols are present.");
