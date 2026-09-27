import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}

export function newHealthId(): string {
  const block = randomBytes(3).toString("hex").slice(0, 4).toUpperCase();
  const num = (1000 + (randomBytes(2).readUInt16BE(0) % 9000)).toString();
  return `PUGA-${block}-${num}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 32)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const derived = (await scrypt(password, salt, 32)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function maskHealthId(healthId: string): string {
  if (!healthId) return "PUGA-••••-••••";
  const parts = healthId.split("-");
  if (parts.length < 3) return "PUGA-••••-••••";
  return `PUGA-••••-${parts[2]}`;
}
