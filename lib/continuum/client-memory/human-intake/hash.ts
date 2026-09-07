import { createHash } from "node:crypto";

const SHA256_RE = /^[a-f0-9]{64}$/;

export function isContentSha256(value: string): boolean {
  return SHA256_RE.test(value);
}

export function sha256Utf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
