import { createRequire } from "node:module";
import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const { nodeFileTrace } = require("next/dist/compiled/@vercel/nft");
const entries = (await readdir(".ops"))
  .filter((name) => name.endsWith(".cjs"))
  .map((name) => join(".ops", name));
// start.cjs loads only Node builtins and Next's already traced standalone server.js.
entries.push("scripts/telegram-ops.mjs");
const { fileList, warnings } = await nodeFileTrace(entries, {
  base: process.cwd(),
  processCwd: process.cwd(),
});
// Use the same maintained tracer as Next, including dynamic/native assets.
const dependencies = [...fileList]
  .filter((path) => path.startsWith("node_modules/"))
  .sort();
for (const path of dependencies) {
  const target = join(".next/standalone", path);
  await mkdir(dirname(target), { recursive: true });
  await cp(path, target, { dereference: false });
}
await writeFile(
  ".ops/dependency-trace.json",
  JSON.stringify(
    {
      entries,
      dependencyFiles: dependencies.length,
      warnings: [...warnings].map((warning) => warning.message),
    },
    null,
    2,
  ),
);
if (warnings.size)
  throw new Error("Operational dependency tracing warnings require review");
