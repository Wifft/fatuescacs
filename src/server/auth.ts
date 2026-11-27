// Accounts with username + password. Passwords and recovery codes are hashed with scrypt;
// session tokens are random and stored as SHA-256 hashes. Server-only module.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import type { Db } from "./db";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;
export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

export const USERNAME_RE = /^[A-Za-z0-9_-]{3,30}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

export type AuthErrorCode =
  | "invalid-username"
  | "invalid-password"
  | "username-taken"
  | "bad-credentials"
  | "bad-recovery"
  | "rate-limited";

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

export interface User {
  id: number;
  username: string;
}

function scrypt(secret: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(
      secret,
      salt,
      SCRYPT.keylen,
      { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

/** `scrypt$N$r$p$salt$hash` (base64url). */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(secret, salt);
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [alg, , , , saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(secret, Buffer.from(saltB64, "base64url"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** 20 random base32 characters in 4 groups: "K7Q2M-9XWPA-…". ~100 bits. */
export function newRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return chars.match(/.{5}/g)!.join("-");
}

const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

function checkCredentials(username: string, password: string) {
  if (!USERNAME_RE.test(username)) throw new AuthError("invalid-username");
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new AuthError("invalid-password");
  }
}

// A real hash to compare against when the user does not exist, so timing doesn't reveal it.
let dummyHash: Promise<string> | null = null;

export async function register(
  db: Db,
  username: string,
  password: string,
  now = Date.now(),
): Promise<{ user: User; recoveryCode: string }> {
  checkCredentials(username, password);
  const exists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
  if (exists) throw new AuthError("username-taken");
  const recoveryCode = newRecoveryCode();
  const [passwordHash, recoveryHash] = await Promise.all([
    hashSecret(password),
    hashSecret(normalizeCode(recoveryCode)),
  ]);
  try {
    const r = db
      .prepare(
        "INSERT INTO users (username, password_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(username, passwordHash, recoveryHash, now);
    return { user: { id: Number(r.lastInsertRowid), username }, recoveryCode };
  } catch {
    // Lost a race with another registration of the same name.
    throw new AuthError("username-taken");
  }
}

export async function login(db: Db, username: string, password: string): Promise<User> {
  const row = db
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username) as { id: number; username: string; password_hash: string } | undefined;
  if (!row) {
    dummyHash ??= hashSecret("dummy-password");
    await verifySecret(password, await dummyHash);
    throw new AuthError("bad-credentials");
  }
  if (!(await verifySecret(password, row.password_hash))) throw new AuthError("bad-credentials");
  return { id: row.id, username: row.username };
}

/** Sets a new password with the recovery code; returns a fresh recovery code (the old one is spent). */
export async function recover(
  db: Db,
  username: string,
  code: string,
  newPassword: string,
): Promise<{ user: User; recoveryCode: string }> {
  checkCredentials(username, newPassword);
  const row = db
    .prepare("SELECT id, username, recovery_hash FROM users WHERE username = ?")
    .get(username) as { id: number; username: string; recovery_hash: string } | undefined;
  const ok = row ? await verifySecret(normalizeCode(code), row.recovery_hash) : false;
  if (!row || !ok) throw new AuthError("bad-recovery");
  const recoveryCode = newRecoveryCode();
  const [passwordHash, recoveryHash] = await Promise.all([
    hashSecret(newPassword),
    hashSecret(normalizeCode(recoveryCode)),
  ]);
  db.prepare("UPDATE users SET password_hash = ?, recovery_hash = ? WHERE id = ?").run(
    passwordHash,
    recoveryHash,
    row.id,
  );
  // Log out every other device.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.id);
  return { user: { id: row.id, username: row.username }, recoveryCode };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function createSession(db: Db, userId: number, now = Date.now()): string {
  const token = randomBytes(32).toString("base64url");
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).run(sha256(token), userId, now, now + SESSION_DAYS * DAY_MS);
  return token;
}

export function sessionUser(db: Db, token: string | undefined, now = Date.now()): User | null {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.username, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as { id: number; username: string; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at <= now) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
    return null;
  }
  return { id: row.id, username: row.username };
}

export function deleteSession(db: Db, token: string | undefined): void {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

/** Fixed-window attempt limiter (in memory: resets on restart, fine for a single process). */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Throws AuthError("rate-limited") when `key` has used up its attempts. */
  check(key: string, now = Date.now()): void {
    const h = this.hits.get(key);
    if (h && h.resetAt > now && h.count >= this.max) throw new AuthError("rate-limited");
  }
  fail(key: string, now = Date.now()): void {
    const h = this.hits.get(key);
    if (!h || h.resetAt <= now) this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
    else h.count++;
  }
  reset(key: string): void {
    this.hits.delete(key);
  }
}
