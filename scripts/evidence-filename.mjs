import { createHash } from "node:crypto";

// Keep commands in manifests; filenames are bounded, portable identifiers.
export function evidenceFilename(stage, label, extension = "log") {
  if (!Number.isSafeInteger(stage) || stage < 0 || !/^[a-z0-9]{1,8}$/.test(extension))
    throw new Error("Invalid evidence stage or extension");
  const raw = String(label);
  const name = raw.normalize("NFKC").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "stage";
  const digest = createHash("sha256").update(`${stage}\0${raw}`).digest("hex").slice(0, 16);
  return `${stage}-${name}-${digest}.${extension}`;
}
