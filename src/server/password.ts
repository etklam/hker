import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const maxmem = Number(process.env.AUTH_SCRYPT_MAXMEM ?? 128 * 1024 * 1024);
if (!Number.isSafeInteger(maxmem) || maxmem < 128 * 1024 * 1024 || maxmem > 1024 * 1024 * 1024)
  throw new Error("Invalid scrypt memory configuration");
const params = { N: 65536, r: 8, p: 1, maxmem };
const format = /^[a-fA-F0-9]{32}:[a-fA-F0-9]{128}$/;
const dummy = `${"00".repeat(16)}:${"00".repeat(64)}`;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (Buffer.byteLength(password, "utf8") > 4096) return reject(new Error("Password too long"));
    scrypt(password, salt, 64, params, (error, key) => error ? reject(error) : resolve(key));
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string | null | undefined) {
  const valid = typeof stored === "string" && stored.length === 161 && format.test(stored);
  const [salt, hash] = (valid ? stored : dummy).split(":");
  // Invalid/absent identities do the same bounded KDF work; compare only equal-sized buffers.
  const derived = await derive(password, Buffer.from(salt, "hex"));
  return timingSafeEqual(Buffer.from(hash, "hex"), derived) && valid;
}
