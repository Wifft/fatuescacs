// English opening names (lichess-org/chess-openings, Lichess/Chess.com APIs) → Spanish.
// Applied at display time: the canonical English name is what we store and group by.
//
// A name is "Family: Variation, Sub-variation"; each segment is translated on its own.
//   1. Exact phrases for idiomatic names ("Ruy Lopez" → "Apertura española").
//   2. Otherwise the segment is tokenised (multi-word nouns first, longest match) and the
//      head — the noun the rest describes, usually the last one — moves to the front:
//        head + moves + proper names + adjectives + noun complements + trailing participles
//      Adjectives agree with the head and go in reverse English order ("Old Indian" →
//      "india antigua"); noun complements are reversed too ("King's Knight" → "del caballo de
//      rey"), the outermost one taking an article when the head is a variation/line/system.
// Unknown words are kept as they are: almost always proper names (Najdorf, Winawer…).
import { toSpanishSan } from "./notation";

type Gender = "m" | "f";

interface Noun {
  /** Spanish noun phrase, lower case ("caballo", "peón envenenado"). */
  es: string;
  g: Gender;
  pl?: boolean;
}

/** Nouns that head a segment ("… Defense") and the Spanish word that leads it. */
const HEADS: Record<string, Noun> = {
  Defense: { es: "defensa", g: "f" },
  Defence: { es: "defensa", g: "f" },
  Opening: { es: "apertura", g: "f" },
  Game: { es: "partida", g: "f" },
  Gambit: { es: "gambito", g: "m" },
  Countergambit: { es: "contragambito", g: "m" },
  Attack: { es: "ataque", g: "m" },
  Counterattack: { es: "contraataque", g: "m" },
  Variation: { es: "variante", g: "f" },
  Variations: { es: "variantes", g: "f", pl: true },
  Line: { es: "línea", g: "f" },
  System: { es: "sistema", g: "m" },
  Formation: { es: "formación", g: "f" },
  Trap: { es: "trampa", g: "f" },
  Bind: { es: "estructura", g: "f" },
  Structure: { es: "estructura", g: "f" },
  Setup: { es: "esquema", g: "m" },
  Complex: { es: "complejo", g: "m" },
  Invitation: { es: "invitación", g: "f" },
};

/** Heads after which a single piece complement reads better with an article. */
const ARTICLE_HEADS = new Set([
  "variante",
  "variantes",
  "línea",
  "sistema",
  "estructura",
  "trampa",
]);

/**
 * Nouns that can act as a head (when nothing else does) or as a complement of another head.
 * `art`: always takes an article as a complement ("del cambio"); pieces don't by default
 * ("Gambito de rey") but do after a variation/line ("Variante del caballo").
 */
const NOUNS: Record<string, Noun & { art?: boolean; poss?: boolean; asName?: string }> = {
  // pieces
  King: { es: "rey", g: "m" },
  "King's": { es: "rey", g: "m", poss: true },
  Queen: { es: "dama", g: "f" },
  "Queen's": { es: "dama", g: "f", poss: true },
  Bishop: { es: "alfil", g: "m" },
  "Bishop's": { es: "alfil", g: "m" },
  Knight: { es: "caballo", g: "m" },
  "Knight's": { es: "caballo", g: "m" },
  Rook: { es: "torre", g: "f" },
  "Rook's": { es: "torre", g: "f" },
  Pawn: { es: "peón", g: "m" },
  Pawns: { es: "peones", g: "m", pl: true },
  Knights: { es: "caballos", g: "m", pl: true },
  // ideas
  Exchange: { es: "cambio", g: "m", art: true },
  Advance: { es: "avance", g: "m", art: true },
  Fianchetto: { es: "fianchetto", g: "m", art: true },
  Retreat: { es: "retirada", g: "f", art: true },
  Pin: { es: "clavada", g: "f", art: true },
  Check: { es: "jaque", g: "m", art: true },
  Center: { es: "centro", g: "m", art: true },
  Wing: { es: "flanco", g: "m", art: true },
  Kingside: { es: "flanco de rey", g: "m", art: true },
  Queenside: { es: "flanco de dama", g: "m", art: true },
  Dragon: { es: "dragón", g: "m", art: true },
  Hedgehog: { es: "erizo", g: "m", art: true },
  Elephant: { es: "elefante", g: "m", art: true },
  Rat: { es: "rata", g: "f", art: true },
  Lion: { es: "león", g: "m", art: true },
  "Lion's": { es: "león", g: "m", art: true },
  Vulture: { es: "buitre", g: "m", art: true },
  Fork: { es: "horquilla", g: "f", art: true },
  Trick: { es: "truco", g: "m", art: true },
  Endgame: { es: "final", g: "m", art: true },
  Sacrifice: { es: "sacrificio", g: "m", art: true },
  Transfer: { es: "transferencia", g: "f", art: true },
  Hunt: { es: "caza", g: "f", art: true },
  Edge: { es: "borde", g: "m", art: true },
  Grab: { es: "captura", g: "f", art: true },
  Push: { es: "avance", g: "m", art: true },
  Return: { es: "devolución", g: "f", art: true },
  Storm: { es: "avalancha", g: "f", art: true },
  Walk: { es: "paseo", g: "m", art: true },
  March: { es: "marcha", g: "f", art: true },
  Tour: { es: "recorrido", g: "m", art: true },
  Swap: { es: "cambio", g: "m", art: true },
  Pass: { es: "paso", g: "m", art: true },
  Head: { es: "cabeza", g: "f", art: true },
  Breakthrough: { es: "ruptura", g: "f", art: true },
  Hybrid: { es: "híbrido", g: "m", art: true },
  Pterodactyl: { es: "pterodáctilo", g: "m", asName: "Pterodáctilo" },
  Pteranodon: { es: "pteranodonte", g: "m", asName: "Pteranodonte" },
  Beginner: { es: "principiante", g: "m", art: true },
  "Beginner's": { es: "principiante", g: "m", art: true },
  // multi-word nouns (matched first, longest wins)
  "Move Order": { es: "orden de jugadas", g: "m", art: true },
  "Poisoned Pawn": { es: "peón envenenado", g: "m", art: true },
  "Double Fianchetto": { es: "doble fianchetto", g: "m", art: true },
  "Classical Fianchetto": { es: "fianchetto clásico", g: "m", art: true },
  "Delayed Exchange": { es: "cambio retrasado", g: "m", art: true },
  "Delayed Fianchetto": { es: "fianchetto retrasado", g: "m", art: true },
  "Deferred Fianchetto": { es: "fianchetto diferido", g: "m", art: true },
  "Immediate Fianchetto": { es: "fianchetto inmediato", g: "m", art: true },
  "Central Exchange": { es: "cambio central", g: "m", art: true },
  "Pawn Storm": { es: "avalancha de peones", g: "f", art: true },
  "Pawn Center": { es: "centro de peones", g: "m", art: true },
  "Pawn Push": { es: "avance del peón", g: "m", art: true },
  "Pawn Grab": { es: "captura del peón", g: "f", art: true },
  "Pawn Return": { es: "devolución del peón", g: "f", art: true },
  "Pawn Sacrifice": { es: "sacrificio de peón", g: "m", art: true },
  "Double Pawn Sacrifice": { es: "doble sacrificio de peón", g: "m", art: true },
  "Bishop Sacrifice": { es: "sacrificio de alfil", g: "m", art: true },
  "Knight Sacrifice": { es: "sacrificio de caballo", g: "m", art: true },
  "Bishop Check": { es: "jaque de alfil", g: "m", art: true },
  "Knight's Tour": { es: "recorrido del caballo", g: "m", art: true },
  "King Walk": { es: "paseo del rey", g: "m", art: true },
  "King March": { es: "marcha del rey", g: "f", art: true },
  "Bishop Swap": { es: "cambio de alfiles", g: "m", art: true },
  "Pawn Pass": { es: "paso del peón", g: "m", art: true },
  "Prickly Pawn": { es: "peón espinoso", g: "m", art: true },
  "Drunken Knight": { es: "caballo borracho", g: "m", art: true },
  "Bouncing Bishop": { es: "alfil saltarín", g: "m", art: true },
  "Wayward Queen": { es: "dama descarriada", g: "f", art: true },
};

/** Adjectives: [masculine, feminine]. */
const ADJ: Record<string, [string, string]> = {
  Sicilian: ["siciliano", "siciliana"],
  French: ["francés", "francesa"],
  "Franco-Sicilian": ["francosiciliano", "francosiciliana"],
  Italian: ["italiano", "italiana"],
  English: ["inglés", "inglesa"],
  Spanish: ["español", "española"],
  Scotch: ["escocés", "escocesa"],
  Dutch: ["holandés", "holandesa"],
  Slav: ["eslavo", "eslava"],
  "Semi-Slav": ["semieslavo", "semieslava"],
  Indian: ["indio", "india"],
  "Nimzo-Indian": ["nimzoindio", "nimzoindia"],
  "Bogo-Indian": ["bogoindio", "bogoindia"],
  "Anglo-Indian": ["angloindio", "angloindia"],
  "Anglo-Slav": ["angloeslavo", "angloeslava"],
  "Anglo-Dutch": ["angloholandés", "angloholandesa"],
  "Anglo-Scandinavian": ["angloescandinavo", "angloescandinava"],
  Scandinavian: ["escandinavo", "escandinava"],
  Hungarian: ["húngaro", "húngara"],
  Polish: ["polaco", "polaca"],
  Portuguese: ["portugués", "portuguesa"],
  Danish: ["danés", "danesa"],
  Latvian: ["letón", "letona"],
  Czech: ["checo", "checa"],
  Russian: ["ruso", "rusa"],
  Austrian: ["austriaco", "austriaca"],
  Yugoslav: ["yugoslavo", "yugoslava"],
  Mexican: ["mexicano", "mexicana"],
  Australian: ["australiano", "australiana"],
  Swiss: ["suizo", "suiza"],
  Norwegian: ["noruego", "noruega"],
  Siberian: ["siberiano", "siberiana"],
  Irish: ["irlandés", "irlandesa"],
  Basque: ["vasco", "vasca"],
  American: ["americano", "americana"],
  Valencian: ["valenciano", "valenciana"],
  Catalan: ["catalán", "catalana"],
  "Neo-Catalan": ["neocatalán", "neocatalana"],
  Vienna: ["vienés", "vienesa"],
  Baltic: ["báltico", "báltica"],
  Western: ["occidental", "occidental"],
  Eastern: ["oriental", "oriental"],
  East: ["oriental", "oriental"],
  Classical: ["clásico", "clásica"],
  "Semi-Classical": ["semiclásico", "semiclásica"],
  Modern: ["moderno", "moderna"],
  "Neo-Modern": ["neomoderno", "neomoderna"],
  Closed: ["cerrado", "cerrada"],
  Open: ["abierto", "abierta"],
  Normal: ["normal", "normal"],
  Orthodox: ["ortodoxo", "ortodoxa"],
  Symmetrical: ["simétrico", "simétrica"],
  Main: ["principal", "principal"],
  Old: ["antiguo", "antigua"],
  Accelerated: ["acelerado", "acelerada"],
  Hyperaccelerated: ["hiperacelerado", "hiperacelerada"],
  Double: ["doble", "doble"],
  Deferred: ["diferido", "diferida"],
  Delayed: ["retrasado", "retrasada"],
  "Ultra-Delayed": ["ultrarretrasado", "ultrarretrasada"],
  Quiet: ["tranquilo", "tranquila"],
  Traditional: ["tradicional", "tradicional"],
  Positional: ["posicional", "posicional"],
  Central: ["central", "central"],
  Reversed: ["invertido", "invertida"],
  Poisoned: ["envenenado", "envenenada"],
  Defensive: ["defensivo", "defensiva"],
  New: ["nuevo", "nueva"],
  Early: ["temprano", "temprana"],
  Long: ["largo", "larga"],
  Full: ["completo", "completa"],
  Flexible: ["flexible", "flexible"],
  Hybrid: ["híbrido", "híbrida"],
  Declined: ["rehusado", "rehusada"],
  Accepted: ["aceptado", "aceptada"],
  Global: ["global", "global"],
  Special: ["especial", "especial"],
  Simple: ["simple", "simple"],
  Wild: ["salvaje", "salvaje"],
  Fast: ["rápido", "rápida"],
  Slow: ["lento", "lenta"],
  Improved: ["mejorado", "mejorada"],
  Immediate: ["inmediato", "inmediata"],
  Extended: ["extendido", "extendida"],
  Bouncing: ["saltarín", "saltarina"],
  Drunken: ["borracho", "borracha"],
  Prickly: ["espinoso", "espinosa"],
  Royal: ["real", "real"],
};

/** Adjective forms, also prefixed ones: "Anti-Classical" → anticlásico, "Neo-Classical" → neoclásico. */
function adjOf(t: string): [string, string] | null {
  if (ADJ[t]) return ADJ[t] as [string, string];
  const m = /^(Anti|Neo|Semi|Pseudo|Ultra)-(.+)$/.exec(t);
  const base = m?.[2] ? ADJ[m[2]] : undefined;
  if (!m?.[1] || !base) return null;
  const p = m[1].toLowerCase();
  return [p + base[0], p + base[1]];
}

/** Participles that follow the head in English ("Gambit Declined"). */
const TRAILING = new Set([
  "Declined",
  "Accepted",
  "Deferred",
  "Delayed",
  "Accelerated",
  "Reversed",
]);

const NUMBERS: Record<string, string> = {
  Two: "dos",
  Three: "tres",
  Four: "cuatro",
  Five: "cinco",
  Six: "seis",
};
const COUNTED: Record<string, string> = {
  Knights: "caballos",
  Knight: "caballos",
  Pawns: "peones",
  Pawn: "peones",
  Bishops: "alfiles",
};

/** Proper nouns with a usual Spanish form, and fixed modifiers kept without "de". */
const PROPER: Record<string, string> = {
  "St.": "San",
  George: "Jorge",
  Berlin: "Berlín",
  Moscow: "Moscú",
  Paris: "París",
  Zurich: "Zúrich",
  Petersburg: "Petersburgo",
  Leningrad: "Leningrado",
  Venice: "Venecia",
  Warsaw: "Varsovia",
  Stockholm: "Estocolmo",
  London: "Londres",
  Amsterdam: "Ámsterdam",
  Saragossa: "Zaragoza",
  Dresden: "Dresde",
  Cracow: "Cracovia",
  Lopez: "López",
  Noah: "Noé",
  "New York": "Nueva York",
  "New England": "Nueva Inglaterra",
  Kangaroo: "canguro",
  Hippopotamus: "hipopótamo",
  Amazon: "amazona",
  Sodium: "sodio",
  Bayonet: "bayoneta",
};

/** Whole segments with an idiomatic Spanish name. */
const PHRASES: Record<string, string> = {
  "Ruy Lopez": "Apertura española",
  "Main Line": "Línea principal",
  Mainline: "Línea principal",
  "Giuoco Piano": "Giuoco Piano",
  "Giuoco Pianissimo": "Giuoco Pianissimo",
  "Queen's Pawn Game": "Partida de peón de dama",
  "Queen's Pawn": "Peón de dama",
  "King's Pawn Game": "Partida de peón de rey",
  "King's Pawn Opening": "Apertura de peón de rey",
  "King's Knight Opening": "Apertura de caballo de rey",
  "King's English": "Inglesa de rey",
  "King David's Opening": "Apertura del rey David",
  "Center Game": "Partida del centro",
  "Center Game Accepted": "Partida del centro aceptada",
  "Vienna Game": "Partida vienesa",
  "Petrov's Defense": "Defensa Petrov",
  "Anderssen's Opening": "Apertura Anderssen",
  "St. George Defense": "Defensa San Jorge",
  "Fried Fox Defense": "Defensa del zorro frito",
  "Lemming Defense": "Defensa Lemming",
  "English Orangutan": "Orangután inglés",
  "Paleface Attack": "Ataque Rostro Pálido",
  "Lasker Simul Special": "Especial de simultáneas de Lasker",
  "Creepy Crawly Formation": "Formación Creepy Crawly",
  "Queen's Indian Accelerated": "India de dama acelerada",
  "Slav Indian": "India eslava",
  "Pseudo Queen's Indian Defense": "Defensa pseudoindia de dama",
  "Anti-Queen's Indian System": "Sistema anti india de dama",
  "Queen's Gambit Invitation": "Invitación al gambito de dama",
  "Bongcloud Attack": "Ataque Bongcloud",
  "Noah's Ark Trap": "Trampa del arca de Noé",
  "Fishing Pole Variation": "Variante de la caña de pescar",
  "Fried Liver Attack": "Ataque Fegatello",
  "Poisoned Pawn Variation Declined": "Variante del peón envenenado rehusada",
  "Sicilian Two Knights": "Siciliana de los dos caballos",
  "Lion's Cave": "Cueva del león",
  "Lion's Claw": "Garra del león",
  "Lion's Jaw": "Mandíbula del león",
  "The Goblin": "El duende",
  "The Potato": "La patata",
  "The Squirrel": "La ardilla",
  "The Walrus": "La morsa",
  "The Whale": "La ballena",
  "Wing Gambit": "Gambito del flanco",
  "Long Whip": "Látigo largo",
  "Anti-Sicilian": "Antisiciliana",
  "Semi-Open": "Semiabierta",
  Formation: "Formación",
};

/** SAN-looking tokens inside names ("5.Nf3", "Bb4+", "e3") → Spanish piece letters. */
const MOVE_TOKEN = /^(\d+\.(\.\.)?)?([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?|O-O(-O)?)$/;

const MULTI_KEYS = [...Object.keys(NOUNS), ...Object.keys(PROPER)]
  .filter((k) => k.includes(" "))
  .sort((a, b) => b.split(" ").length - a.split(" ").length);

/** Splits into tokens, joining known multi-word nouns/names into one token. */
function tokenize(s: string): string[] {
  const words = s.split(" ").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length;) {
    const key = MULTI_KEYS.find((k) => k.split(" ").every((p, j) => words[i + j] === p));
    if (key) {
      out.push(key);
      i += key.split(" ").length;
    } else out.push(words[i++] as string);
  }
  return out;
}

/** Upper-cases the first letter, unless the segment starts with a move ("e3"). */
const capitalize = (s: string) =>
  MOVE_TOKEN.test(s.split(" ")[0] ?? "") ? s : s.charAt(0).toUpperCase() + s.slice(1);

function withArticle(n: Noun): string {
  if (n.pl) return `de los ${n.es}`;
  return n.g === "m" ? `del ${n.es}` : `de la ${n.es}`;
}

function agree(adj: [string, string], head: Noun): string {
  const base = adj[head.g === "m" ? 0 : 1];
  if (!head.pl) return base;
  return /[aeiouáéó]$/.test(base) ? `${base}s` : `${base}es`;
}

type Complement = Noun & { art?: boolean; poss?: boolean; fixed?: string };

function translateSegment(segment: string): string {
  const s = segment.trim();
  if (!s) return s;
  if (PHRASES[s]) return PHRASES[s] as string;

  // "with e3", "with Max Lange Defense" → "con e3", "con defensa Max Lange".
  if (s.startsWith("with ")) {
    const rest = translateSegment(s.slice(5));
    const startsWithMove = MOVE_TOKEN.test(s.slice(5).split(" ")[0] ?? "");
    return `con ${startsWithMove ? rest : rest.charAt(0).toLowerCase() + rest.slice(1)}`;
  }

  const tokens = tokenize(s);

  // "Three Knights", "Two Pawns": number + counted noun.
  if (tokens.length === 2 && NUMBERS[tokens[0] as string] && COUNTED[tokens[1] as string]) {
    return capitalize(`${NUMBERS[tokens[0] as string]} ${COUNTED[tokens[1] as string]}`);
  }

  // Head: scanning from the end over trailing participles and moves, the first head noun or,
  // failing that, the first noun ("Classical Fianchetto" → "Fianchetto clásico").
  let headIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i] as string;
    if (HEADS[t] || NOUNS[t]) {
      headIdx = i;
      break;
    }
    if (!TRAILING.has(t) && !MOVE_TOKEN.test(t)) break;
  }
  if (headIdx === -1) {
    // A bare adjective names a variation ("Ruy Lopez: Closed" → "Cerrada"): feminine,
    // adjectives first, then the proper names ("Döry Indian" → "India Döry").
    if (tokens.some((t) => adjOf(t))) {
      const adjs = tokens
        .filter((t) => adjOf(t))
        .reverse()
        .map((t) => (adjOf(t) as [string, string])[1]);
      const rest = tokens.filter((t) => !adjOf(t)).map(translateLoose);
      return capitalize([...adjs, ...rest].join(" "));
    }
    return capitalize(tokens.map(translateLoose).join(" "));
  }

  const headToken = tokens[headIdx] as string;
  const head: Noun = HEADS[headToken] ?? (NOUNS[headToken] as Noun);

  const names: string[] = [];
  const adjs: string[] = [];
  const complements: Complement[] = [];
  const trailing: string[] = [];
  const moves: string[] = [];

  const mods = tokens.slice(0, headIdx);
  for (let i = 0; i < mods.length; i++) {
    const t = mods[i] as string;
    const next = mods[i + 1];
    if (NUMBERS[t] && next && COUNTED[next]) {
      complements.push({ es: "", g: "m", fixed: `de los ${NUMBERS[t]} ${COUNTED[next]}` });
      i++;
    } else if (HEADS[t]) {
      // A head noun used as a modifier ("Bradford Attack Variation"): it takes the names
      // before it → "del ataque Bradford".
      const n = HEADS[t] as Noun;
      const bound = names.splice(0).join(" ");
      complements.push({ ...n, fixed: [withArticle(n), bound].filter(Boolean).join(" ") });
    } else if (NOUNS[t]?.asName) {
      names.push(NOUNS[t]?.asName as string); // "Pterodactyl Defense" → "Defensa Pterodáctilo"
    } else if (NOUNS[t]) {
      complements.push(NOUNS[t] as Complement);
    } else if (adjOf(t)) {
      adjs.unshift(agree(adjOf(t) as [string, string], head));
    } else if (MOVE_TOKEN.test(t)) {
      moves.push(toSpanishSan(t));
    } else if (PROPER[t]) {
      names.push(PROPER[t] as string);
    } else if (/^[A-Z][\w-]*'s$/.test(t)) {
      names.push(t.slice(0, -2)); // "Petrov's" → "Petrov"
    } else {
      names.push(t);
    }
  }
  for (const t of tokens.slice(headIdx + 1)) {
    if (MOVE_TOKEN.test(t)) moves.push(toSpanishSan(t));
    else if (adjOf(t)) trailing.push(agree(adjOf(t) as [string, string], head));
    else names.push(PROPER[t] ?? t);
  }

  // English stacks noun modifiers left to right; Spanish nests them the other way round.
  const ordered = complements.reverse();
  const comps = ordered.map((c, i) => {
    if (c.fixed) return c.fixed;
    // "King's"/"Queen's" stay bare ("india de rey"); pieces after a variation take "del".
    const article =
      c.art || (i === 0 && !c.poss && (ordered.length > 1 || ARTICLE_HEADS.has(head.es)));
    return article ? withArticle(c) : `de ${c.es}`;
  });

  return capitalize(
    [head.es, ...moves, ...names, ...adjs, ...comps, ...trailing].filter(Boolean).join(" "),
  );
}

/** Word-by-word fallback for segments without any noun to hang the rest on. */
function translateLoose(t: string): string {
  if (MOVE_TOKEN.test(t)) return toSpanishSan(t);
  if (PROPER[t]) return PROPER[t] as string;
  const adj = adjOf(t);
  if (adj) return adj[0];
  if (NUMBERS[t]) return NUMBERS[t] as string;
  return t;
}

const cache = new Map<string, string>();

/** "Sicilian Defense: Najdorf Variation, English Attack" →
 *  "Defensa siciliana: Variante Najdorf, Ataque inglés". */
export function openingNameEs(name: string): string {
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  const i = name.indexOf(": ");
  const family = i === -1 ? name : name.slice(0, i);
  const rest = i === -1 ? null : name.slice(i + 2);
  // The family can itself carry ", with …" ("Queen's Indian Defense, with e3").
  const out =
    family.split(", ").map(translateSegment).join(", ") +
    (rest === null ? "" : `: ${rest.split(", ").map(translateSegment).join(", ")}`);
  cache.set(name, out);
  return out;
}
