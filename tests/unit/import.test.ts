import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { importChesscom } from "@/lib/import/chesscom";
import { ImportError, PoliteHttp, validUsername } from "@/lib/import/http";
import { importLichess } from "@/lib/import/lichess";
import { formatTimeControl, userOutcome } from "@/lib/import/types";

const fixture = (f: string) => readFileSync(join(__dirname, "fixtures", f), "utf8");

type Route = (url: string) => { status: number; body: string } | undefined;

/** Fake fetch backed by recorded responses; records the URLs it was asked for. */
function fakeFetch(route: Route) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const r = route(url) ?? { status: 404, body: '{"error":"Not found"}' };
    return new Response(r.body, { status: r.status });
  }) as typeof fetch;
  return { impl, calls };
}

const noSleep = { sleep: async () => {} };

describe("PoliteHttp", () => {
  it("retries 5xx with growing waits and caches successes", async () => {
    let n = 0;
    const waits: number[] = [];
    const http = new PoliteHttp({
      fetchImpl: (async () => new Response("ok", { status: ++n < 3 ? 503 : 200 })) as typeof fetch,
      sleep: async (ms) => {
        waits.push(ms);
      },
      baseDelayMs: 100,
    });
    expect((await http.get("https://x/a")).text).toBe("ok");
    expect(waits).toEqual([100, 200]);
    await http.get("https://x/a");
    expect(n).toBe(3); // cached
  });

  it("waits a full minute after 429 and then gives up with rate-limited", async () => {
    const waits: number[] = [];
    const http = new PoliteHttp({
      fetchImpl: (async () => new Response("", { status: 429 })) as typeof fetch,
      sleep: async (ms) => {
        waits.push(ms);
      },
      retries: 2,
    });
    await expect(http.get("https://x/b")).rejects.toMatchObject({ kind: "rate-limited" });
    expect(waits).toEqual([60_000, 60_000]);
  });

  it("serialises requests (one at a time)", async () => {
    let active = 0;
    let maxActive = 0;
    const http = new PoliteHttp({
      fetchImpl: (async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return new Response("ok");
      }) as typeof fetch,
    });
    await Promise.all([http.get("https://x/1"), http.get("https://x/2"), http.get("https://x/3")]);
    expect(maxActive).toBe(1);
  });

  it("reports network errors", async () => {
    const http = new PoliteHttp({
      ...noSleep,
      retries: 1,
      fetchImpl: (async () => {
        throw new TypeError("Failed to fetch");
      }) as typeof fetch,
    });
    await expect(http.get("https://x/c")).rejects.toMatchObject({ kind: "network" });
  });
});

describe("usernames", () => {
  it("accepts site usernames and rejects anything else", () => {
    expect(validUsername("Zablotsky_Sergei")).toBe(true);
    expect(validUsername("Sina-Movahed")).toBe(true);
    expect(validUsername("a")).toBe(false);
    expect(validUsername("../etc")).toBe(false);
    expect(validUsername("with space")).toBe(false);
  });
});

describe("importLichess (recorded response)", () => {
  it("parses NDJSON games with pgn, players, result, speed and opening", async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.includes("/api/games/user/Zablotsky_Sergei")
        ? { status: 200, body: fixture("lichess-games.ndjson") }
        : undefined,
    );
    const games = await importLichess("Zablotsky_Sergei", new PoliteHttp({ fetchImpl: impl }));
    expect(calls[0]).toBe(
      "https://lichess.org/api/games/user/Zablotsky_Sergei?max=20&pgnInJson=true&opening=true",
    );
    expect(games).toHaveLength(2);
    const g = games[0]!;
    expect(g.source).toBe("lichess");
    expect(g.id).toBe("8oyHma3y");
    expect(g.url).toBe("https://lichess.org/8oyHma3y");
    expect(g.userColor).toBe("w");
    expect(g.result).toBe("0-1");
    expect(userOutcome(g)).toBe("loss");
    expect(g.speed).toBe("blitz");
    expect(g.timeControl).toBe("3+0");
    expect(g.siteOpening?.eco).toBe("C25");
    expect(g.pgn).toContain('[Site "https://lichess.org/game/8oyHma3y"]');
    expect(games[1]!.userColor).toBe("b");
    expect(userOutcome(games[1]!)).toBe("win");
  });

  it("distinguishes unknown users from users without games", async () => {
    const unknown = fakeFetch(() => undefined);
    await expect(
      importLichess("nadie_existe", new PoliteHttp({ fetchImpl: unknown.impl })),
    ).rejects.toMatchObject({ kind: "not-found" });

    const empty = fakeFetch((url) =>
      url.endsWith("/api/user/lichess") ? { status: 200, body: '{"id":"lichess"}' } : undefined,
    );
    await expect(
      importLichess("lichess", new PoliteHttp({ fetchImpl: empty.impl })),
    ).rejects.toMatchObject({ kind: "no-games" });
  });

  it("rejects invalid usernames without any request", async () => {
    const f = fakeFetch(() => undefined);
    await expect(
      importLichess("../../admin", new PoliteHttp({ fetchImpl: f.impl })),
    ).rejects.toBeInstanceOf(ImportError);
    expect(f.calls).toHaveLength(0);
  });
});

describe("importChesscom (recorded responses)", () => {
  const routes: Route = (url) => {
    if (url.endsWith("/pub/player/hikaru/games/archives"))
      return { status: 200, body: fixture("chesscom-archives.json") };
    if (url.endsWith("/games/2026/11"))
      return { status: 200, body: fixture("chesscom-2026-11.json") };
    if (url.endsWith("/games/2026/10"))
      return { status: 200, body: fixture("chesscom-2026-10.json") };
    return undefined;
  };

  it("reads the last month, then the previous one, skipping variants, newest first", async () => {
    const { impl, calls } = fakeFetch(routes);
    const games = await importChesscom("Hikaru", new PoliteHttp({ fetchImpl: impl }));
    expect(calls).toEqual([
      "https://api.chess.com/pub/player/hikaru/games/archives",
      "https://api.chess.com/pub/player/hikaru/games/2026/11",
      "https://api.chess.com/pub/player/hikaru/games/2026/10",
    ]);
    expect(games).toHaveLength(6); // 3 + 3 standard; the Chess960 game is dropped
    expect(games.every((g) => !g.pgn.includes("Chess960"))).toBe(true);
    const times = games.map((g) => g.playedAt);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(games.every((g) => g.userColor !== null)).toBe(true);
    const draw = games.find((g) => g.result === "1/2-1/2");
    expect(draw && userOutcome(draw)).toBe("draw");
    expect(games[0]!.timeControl).toBe("3+0");
    expect(games[0]!.speed).toBe("blitz");
  });

  it("only reads the last month when it has enough games", async () => {
    const { impl, calls } = fakeFetch(routes);
    const games = await importChesscom("hikaru", new PoliteHttp({ fetchImpl: impl }), 2);
    expect(games).toHaveLength(2);
    expect(calls).toHaveLength(2);
  });

  it("derives a readable opening name from the URL", async () => {
    const { impl } = fakeFetch(routes);
    const games = await importChesscom("hikaru", new PoliteHttp({ fetchImpl: impl }));
    const englund = games.find((g) => g.siteOpening?.name.startsWith("Englund"));
    expect(englund?.siteOpening?.name).toBe("Englund Gambit");
    expect(games.every((g) => !/\d\./.test(g.siteOpening?.name ?? ""))).toBe(true);
  });

  it("reports unknown users", async () => {
    const { impl } = fakeFetch(() => undefined);
    await expect(
      importChesscom("nadie-existe", new PoliteHttp({ fetchImpl: impl })),
    ).rejects.toMatchObject({ kind: "not-found" });
  });
});

describe("formatTimeControl", () => {
  it("formats minutes + increment", () => {
    expect(formatTimeControl(180, 2)).toBe("3+2");
    expect(formatTimeControl(30, 0)).toBe("0,5+0");
    expect(formatTimeControl(900, 10)).toBe("15+10");
  });
});

describe("imported PGNs", () => {
  it("parse with our PGN parser (clock comments, site headers)", async () => {
    const { parsePgn } = await import("@/lib/chess/pgn");
    const lines = fixture("lichess-games.ndjson").trim().split("\n");
    const pgns = [
      ...lines.map((l) => (JSON.parse(l) as { pgn: string }).pgn),
      ...["2026-11", "2026-10"].flatMap((m) =>
        (
          JSON.parse(fixture(`chesscom-${m}.json`)) as { games: { pgn: string; rules: string }[] }
        ).games
          .filter((g) => g.rules === "chess")
          .map((g) => g.pgn),
      ),
    ];
    expect(pgns.length).toBe(8);
    for (const pgn of pgns) expect(parsePgn(pgn).moves.length).toBeGreaterThan(0);
  });
});
