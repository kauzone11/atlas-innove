import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  }
  return secret;
}

export function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function signValue(value: string): string {
  return createHmac("sha256", requireSessionSecret()).update(value).digest("hex");
}

export function isValidSignature(value: string, signature: string): boolean {
  const expected = signValue(value);
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(signature, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
