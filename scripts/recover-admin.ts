import { closeDatabase } from "../src/server/db";
import { recoverAdministrator } from "../src/server/admin-recovery";

async function main() {
  if (process.stdin.isTTY) throw new Error("Supply protected JSON on stdin");
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 20000) throw new Error("Input too large");
    chunks.push(Buffer.from(chunk));
  }
  console.log(
    JSON.stringify(
      await recoverAdministrator(
        JSON.parse(Buffer.concat(chunks).toString("utf8")),
      ),
    ),
  );
}
main()
  .catch(() => {
    console.error(
      "Administrator recovery failed; verify protected input and an existing active administrator.",
    );
    process.exitCode = 1;
  })
  .finally(closeDatabase);
