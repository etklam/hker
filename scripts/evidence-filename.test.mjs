import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceFilename } from "./evidence-filename.mjs";

test("bounded artifact paths remain distinct after normalization", () => {
  const labels = [
    "test:migrations",
    "a/b",
    "a\\b",
    "a\nb",
    "CON",
    "con.txt",
    "NUL",
    "COM1",
    "é",
    "e\u0301",
    "資料",
    "",
    ".",
    "a".repeat(500),
  ];
  const names = labels.map((label) => evidenceFilename(4, label));
  assert.equal(new Set(names).size, labels.length);
  for (const name of names) {
    assert.match(name, /^[a-z0-9_-]+\.log$/);
    assert.ok(name.length <= 96);
  }
  assert.equal(evidenceFilename(4, "test:migrations"), names[0]);
  assert.notEqual(evidenceFilename(5, "test:migrations"), names[0]);
  assert.throws(() => evidenceFilename(1, "x", "../env"));
});
