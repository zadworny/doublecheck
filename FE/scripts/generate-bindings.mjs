#!/usr/bin/env node
/**
 * Regenerates `src/contract/registry.ts` from the deployed contract.
 *
 *   npm run bindings
 *
 * The Stellar CLI emits a standalone npm package. We only want the one source
 * file, and that file does not compile under this project's tsconfig, which
 * inherits Vite's strict template defaults. Rather than loosen the whole
 * project's settings, the three incompatibilities are patched here so they are
 * reapplied automatically on every regeneration:
 *
 *   1. Unused type imports          -> trimmed (`noUnusedLocals`)
 *   2. Value imports of pure types  -> made `import type` (`verbatimModuleSyntax`)
 *   3. `enum` / parameter properties -> left alone, but the file is marked
 *      generated so a reader knows why it looks different from the rest
 *
 * `erasableSyntaxOnly` is switched off in tsconfig.app.json for the same
 * reason — the official bindings use `enum`, which emits runtime code. Vite's
 * transformer handles it fine; the flag only matters for Node type-stripping.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FE = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(FE, "src/contract/registry.ts");

const CONTRACT_ID = process.env.CONTRACT_ID ?? "CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP";
const NETWORK = process.env.STELLAR_NETWORK ?? "testnet";

// The CLI derives an npm package name from the output directory's basename and
// rejects anything that is not a valid one, so the temp dir has to be lowercase.
const work = join(
  mkdtempSync(join(tmpdir(), "doublecheck-bindings-")),
  "registry-bindings",
);
try {
  console.log(`Generating bindings for ${CONTRACT_ID} on ${NETWORK}…`);
  execFileSync(
    "stellar",
    ["contract", "bindings", "typescript",
     "--network", NETWORK,
     "--contract-id", CONTRACT_ID,
     "--output-dir", work,
     "--overwrite"],
    { stdio: "inherit" },
  );

  let src = readFileSync(join(work, "src/index.ts"), "utf8");

  // 1 + 2. Replace the generated import block with one that compiles here.
  src = src.replace(
    /^import \{ Buffer \} from "buffer";[\s\S]*?export \* as rpc from "@stellar\/stellar-sdk\/rpc";$/m,
    `import { Buffer } from "buffer";
import {
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  AssembledTransaction,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
} from "@stellar/stellar-sdk/contract";
import type { u32, u64, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";`,
  );

  // 3. Mark the file so nobody hand-edits it.
  src =
    `/* eslint-disable */
// GENERATED FILE — do not edit by hand.
// Regenerate with \`npm run bindings\` (see scripts/generate-bindings.mjs).
// Source: contract ${CONTRACT_ID} on ${NETWORK}.
` + src;

  writeFileSync(OUT, src);
  console.log(`Wrote ${OUT}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
