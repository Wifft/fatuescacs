import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openingNameEs } from "@/lib/chess/opening-names-es";

const table = (
  JSON.parse(readFileSync(join(__dirname, "../../public/openings.json"), "utf8")) as {
    positions: Record<string, [string, string] | 0>;
  }
).positions;
const allNames = [
  ...new Set(
    Object.values(table)
      .filter((v): v is [string, string] => v !== 0)
      .map((v) => v[1]),
  ),
];

describe("openingNameEs", () => {
  it.each([
    [
      "Sicilian Defense: Najdorf Variation, English Attack",
      "Defensa siciliana: Variante Najdorf, Ataque inglés",
    ],
    ["Ruy Lopez: Closed, Anti-Marshall", "Apertura española: Cerrada, Anti-Marshall"],
    ["King's Indian Defense", "Defensa india de rey"],
    [
      "Queen's Gambit Declined: Exchange Variation",
      "Gambito de dama rehusado: Variante del cambio",
    ],
    ["Old Indian Defense", "Defensa india antigua"],
    ["Philidor Defense", "Defensa Philidor"],
    ["Petrov's Defense", "Defensa Petrov"],
    ["Italian Game: Two Knights Defense", "Partida italiana: Defensa de los dos caballos"],
    [
      "French Defense: Winawer Variation, Poisoned Pawn Variation",
      "Defensa francesa: Variante Winawer, Variante del peón envenenado",
    ],
    ["Dutch Defense: Queen's Knight Variation", "Defensa holandesa: Variante del caballo de dama"],
    ["Sicilian Defense: Accelerated Dragon", "Defensa siciliana: Dragón acelerado"],
    ["King's Gambit Accepted: Bishop's Gambit", "Gambito de rey aceptado: Gambito de alfil"],
    ["Queen's Indian Defense, with e3, Bb4+ Line", "Defensa india de dama, con e3, Línea Ab4+"],
    [
      "Benoni Defense: King's Pawn Line, with Bg5",
      "Defensa Benoni: Línea del peón de rey, con Ag5",
    ],
    ["Vienna Gambit, with Max Lange Defense", "Gambito vienés, con defensa Max Lange"],
    ["Ruy Lopez: Berlin Defense", "Apertura española: Defensa Berlín"],
    ["Pterodactyl Defense: Sicilian, Pteranodon", "Defensa Pterodáctilo: Siciliana, Pteranodonte"],
    [
      "Zukertort Opening: Queenside Fianchetto Variation",
      "Apertura Zukertort: Variante del fianchetto del flanco de dama",
    ],
  ])("%s", (en, es) => {
    expect(openingNameEs(en)).toBe(es);
  });

  it("keeps unknown words (proper names) untouched", () => {
    expect(openingNameEs("Caro-Kann Defense: Dinic Gambit")).toBe(
      "Defensa Caro-Kann: Gambito Dinic",
    );
  });

  it("translates every name in the dataset without leaving structural English words", () => {
    const structural =
      /\b(Defen[cs]e|Opening|Variations?|Gambit|Countergambit|Attack|Counterattack|Game|System|Declined|Accepted|Exchange|Advance|Classical|Modern|Closed|Main Line|Knights?|Pawns?|Bishop|Queen's|King's)\b/;
    const leftovers = allNames
      .map((n) => [n, openingNameEs(n)] as const)
      .filter(([, es]) => structural.test(es));
    expect(allNames.length).toBeGreaterThan(3000);
    expect(leftovers.slice(0, 10)).toEqual([]);
  });

  it("is stable (cached) and fast enough to run at display time", () => {
    const t0 = performance.now();
    for (const n of allNames) openingNameEs(n);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
