import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { PositionEval } from "@/lib/engine/uci";
import {
  deleteAnalysis,
  getAnalysis,
  listAnalyses,
  saveAnalysis,
  ValidationError,
} from "@/server/analyses";
import {
  AuthError,
  createSession,
  deleteSession,
  hashSecret,
  login,
  RateLimiter,
  recover,
  register,
  sessionUser,
  verifySecret,
} from "@/server/auth";
import { openDb, type Db } from "@/server/db";

let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
});

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof AuthError ? e.code : String(e)),
  );

describe("schema", () => {
  it("applies migrations once (user_version)", () => {
    const v = db.prepare("PRAGMA user_version").get() as { user_version: number };
    expect(v.user_version).toBe(1);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: unknown) => (r as { name: string }).name);
    expect(tables).toEqual(["analyses", "sessions", "users"]);
  });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies in constant time", async () => {
    const a = await hashSecret("correct horse");
    const b = await hashSecret("correct horse");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifySecret("correct horse", a)).toBe(true);
    expect(await verifySecret("wrong horse", a)).toBe(false);
    expect(await verifySecret("x", "garbage")).toBe(false);
  });
});

describe("accounts", () => {
  it("registers, logs in (case-insensitive username) and rejects bad credentials", async () => {
    const { user, recoveryCode } = await register(db, "Ana_99", "contraseña-larga");
    expect(user.username).toBe("Ana_99");
    expect(recoveryCode).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
    expect((await login(db, "ana_99", "contraseña-larga")).id).toBe(user.id);
    expect(await code(login(db, "Ana_99", "otra-cosa"))).toBe("bad-credentials");
    expect(await code(login(db, "nadie", "contraseña-larga"))).toBe("bad-credentials");
  });

  it("validates usernames and passwords and refuses duplicates", async () => {
    expect(await code(register(db, "a", "12345678"))).toBe("invalid-username");
    expect(await code(register(db, "con espacio", "12345678"))).toBe("invalid-username");
    expect(await code(register(db, "pepe", "1234567"))).toBe("invalid-password");
    await register(db, "pepe", "12345678");
    expect(await code(register(db, "PEPE", "12345678"))).toBe("username-taken");
  });

  it("does not store plain secrets", async () => {
    const { recoveryCode } = await register(db, "luis", "secreto-123");
    const row = db.prepare("SELECT * FROM users").get() as Record<string, string>;
    expect(JSON.stringify(row)).not.toContain("secreto-123");
    expect(JSON.stringify(row)).not.toContain(recoveryCode);
  });

  it("recovers with the code, rotates it and logs out every session", async () => {
    const { user, recoveryCode } = await register(db, "eva", "vieja-clave");
    const token = createSession(db, user.id);
    const r = await recover(db, "EVA", recoveryCode.toLowerCase(), "nueva-clave");
    expect(r.recoveryCode).not.toBe(recoveryCode);
    expect(sessionUser(db, token)).toBeNull();
    expect((await login(db, "eva", "nueva-clave")).id).toBe(user.id);
    expect(await code(login(db, "eva", "vieja-clave"))).toBe("bad-credentials");
    // The old code is spent.
    expect(await code(recover(db, "eva", recoveryCode, "otra-clave-1"))).toBe("bad-recovery");
    expect(await code(recover(db, "nadie", recoveryCode, "otra-clave-1"))).toBe("bad-recovery");
  });
});

describe("sessions", () => {
  it("creates, resolves, expires and deletes sessions (tokens stored hashed)", async () => {
    const { user } = await register(db, "sara", "12345678");
    const now = 1_000_000;
    const token = createSession(db, user.id, now);
    expect(sessionUser(db, token, now + 1)).toEqual({ id: user.id, username: "sara" });
    const stored = db.prepare("SELECT token_hash FROM sessions").get() as { token_hash: string };
    expect(stored.token_hash).not.toBe(token);
    expect(sessionUser(db, token, now + 31 * 86_400_000)).toBeNull();
    const t2 = createSession(db, user.id);
    deleteSession(db, t2);
    expect(sessionUser(db, t2)).toBeNull();
    expect(sessionUser(db, undefined)).toBeNull();
    expect(sessionUser(db, "inventado")).toBeNull();
  });
});

describe("RateLimiter", () => {
  it("blocks after max failures within the window, then resets", () => {
    const rl = new RateLimiter(2, 1000);
    rl.fail("k", 0);
    rl.check("k", 1);
    rl.fail("k", 2);
    expect(() => rl.check("k", 3)).toThrow(AuthError);
    rl.check("k", 1001); // window over
    rl.fail("j", 0);
    rl.fail("j", 0);
    rl.reset("j");
    rl.check("j", 1);
  });
});

describe("analyses", () => {
  const pgn = readFileSync(join(__dirname, "../golden/games/opera.pgn"), "utf8");
  const { evals } = JSON.parse(
    readFileSync(join(__dirname, "../golden/evals/opera.json"), "utf8"),
  ) as { evals: PositionEval[] };
  const body = { pgn, depth: 16, evals, bookPlies: 5, opening: { eco: "C41", name: "Philidor" } };

  it("saves (recomputing the summary), lists, gets and deletes only the owner's analyses", async () => {
    const a = await register(db, "ana", "12345678");
    const b = await register(db, "bea", "12345678");
    const id = saveAnalysis(db, a.user.id, body);

    const list = listAnalyses(db, a.user.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id,
      white: "Paul Morphy",
      result: "1-0",
      depth: 16,
      opening: { eco: "C41", name: "Philidor" },
    });
    expect(list[0]!.accuracy.w).toBeGreaterThan(90);
    expect(list[0]!.counts.b.blunder).toBe(1);

    const detail = getAnalysis(db, a.user.id, id);
    expect(detail?.evals).toHaveLength(evals.length);
    expect(detail?.bookPlies).toBe(5);

    expect(listAnalyses(db, b.user.id)).toHaveLength(0);
    expect(getAnalysis(db, b.user.id, id)).toBeNull();
    expect(deleteAnalysis(db, b.user.id, id)).toBe(false);
    expect(deleteAnalysis(db, a.user.id, id)).toBe(true);
    expect(listAnalyses(db, a.user.id)).toHaveLength(0);
  });

  it("re-saving the same game updates it instead of duplicating", async () => {
    const a = await register(db, "ana", "12345678");
    const id1 = saveAnalysis(db, a.user.id, body, 1);
    const id2 = saveAnalysis(db, a.user.id, { ...body, depth: 20 }, 2);
    expect(id2).toBe(id1);
    expect(listAnalyses(db, a.user.id)).toMatchObject([{ id: id1, depth: 20, updatedAt: 2 }]);
  });

  it("rejects invalid input", async () => {
    const a = await register(db, "ana", "12345678");
    const bad = (over: Record<string, unknown>) => () =>
      saveAnalysis(db, a.user.id, { ...body, ...over });
    expect(bad({ pgn: "1. e4 e5 2. Ke3 Ke6 3. Kxe5" })).toThrow(ValidationError);
    expect(bad({ evals: evals.slice(1) })).toThrow(ValidationError);
    expect(bad({ depth: 0 })).toThrow(ValidationError);
    expect(bad({ bookPlies: 999 })).toThrow(ValidationError);
    expect(bad({ pgn: "x".repeat(100_001) })).toThrow(ValidationError);
    const broken = evals.map((e, i) => (i === 3 ? { ...e, best: "drop table" } : e));
    expect(bad({ evals: broken })).toThrow(ValidationError);
    expect(() => saveAnalysis(db, a.user.id, null)).toThrow(ValidationError);
  });
});
