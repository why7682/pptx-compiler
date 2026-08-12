import assert from "node:assert/strict";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inspectModuleFile,
  inspectModuleSourceBytes,
  splitNullPaths
} from "../scripts/lib/source-policy.mjs";

function codes(findings) {
  return new Set(findings.map(({ code }) => code));
}

test("module source policy accepts canonical ESM and rejects text hazards", () => {
  assert.deepEqual(inspectModuleSourceBytes(Buffer.from("export {};\n"), "safe.mjs"), []);
  assert.equal(codes(inspectModuleSourceBytes(Buffer.from([0xff]), "bad.mjs"))
    .has("source-utf8"), true);
  assert.equal(codes(inspectModuleSourceBytes(Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from("export {};\n")
  ]), "bad.mjs")).has("source-bom"), true);
  assert.equal(codes(inspectModuleSourceBytes(Buffer.from("export {};\r\n"), "bad.mjs"))
    .has("source-line-ending"), true);
  assert.equal(codes(inspectModuleSourceBytes(Buffer.from("export {}; \n"), "bad.mjs"))
    .has("source-trailing-whitespace"), true);
  assert.equal(codes(inspectModuleSourceBytes(Buffer.from("export {};"), "bad.mjs"))
    .has("source-final-newline"), true);
});

test("Node syntax checking is non-executing and fails closed", async (t) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "pptx-source-policy.")));
  t.after(async () => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "safe.mjs"), "throw new Error('must not execute');\n");
  await writeFile(path.join(root, "broken.mjs"), "export const = ;\n");
  assert.deepEqual(await inspectModuleFile({ root, relativePath: "safe.mjs" }), []);
  assert.equal(codes(await inspectModuleFile({ root, relativePath: "broken.mjs" }))
    .has("source-syntax"), true);
});

test("NUL-delimited Git paths must remain canonical", () => {
  assert.deepEqual(splitNullPaths(Buffer.from("a.mjs\0dir/b.mjs\0")), [
    "a.mjs",
    "dir/b.mjs"
  ]);
  assert.throws(() => splitNullPaths(Buffer.from("../escape.mjs\0")), /source-path-list/u);
  assert.throws(() => splitNullPaths(Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from("safe.mjs\0")
  ])), /source-path-list/u);
  assert.throws(() => splitNullPaths(Buffer.from("unterminated.mjs")), /source-path-list/u);
});
