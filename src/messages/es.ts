// Single source of UI strings. Keep every user-facing text here so the UI can be translated later.
import type { MoveClass } from "@/lib/chess/classify";
import type { PgnError } from "@/lib/chess/pgn";

export const messages = {
  app: {
    title: "Analizador de partidas",
    tagline: "Analiza tus partidas de ajedrez con Stockfish, dentro de tu navegador.",
    privacy: "El motor corre en tu dispositivo: tus partidas no salen de él.",
  },
  nav: {
    label: "Navegación principal",
    home: "Analizar",
    import: "Importar",
    history: "Historial",
    account: "Cuenta",
  },
  importPage: {
    title: "Importar partidas",
    intro: "Trae tus últimas 20 partidas de Lichess o Chess.com y analiza la que quieras.",
    source: "Sitio",
    lichess: "Lichess",
    chesscom: "Chess.com",
    username: "Usuario",
    submit: "Importar",
    loading: "Importando…",
    count: (n: number) => `${n} ${n === 1 ? "partida" : "partidas"}`,
    analyze: "Analizar",
    vs: "contra",
    win: "Victoria",
    loss: "Derrota",
    draw: "Tablas",
    unfinished: "Sin terminar",
    listLabel: "Partidas importadas",
    variantsNote: "Solo se importan partidas de ajedrez clásico (sin variantes).",
    errors: {
      "invalid-user": "Ese nombre de usuario no es válido.",
      "not-found": "No existe ese usuario.",
      "no-games": "Ese usuario no tiene partidas de ajedrez clásico.",
      "rate-limited":
        "El sitio nos está limitando las peticiones. Espera un minuto y vuelve a intentarlo.",
      network: "No se pudo conectar con el sitio. Revisa tu conexión.",
      "bad-response": "El sitio ha devuelto una respuesta inesperada.",
    },
    speeds: {
      ultraBullet: "UltraBullet",
      bullet: "Bala",
      blitz: "Blitz",
      rapid: "Rápida",
      classical: "Clásica",
      daily: "Por correspondencia",
    },
  },
  home: {
    pgnLabel: "Partida en PGN",
    pgnHelp: "Pega una partida en formato PGN. Hay una de ejemplo precargada.",
    depthLabel: "Profundidad",
    analyze: "Analizar",
    loadSample: "Cargar la partida de ejemplo",
    sampleNote:
      "Partida de ejemplo: Morphy contra el duque de Brunswick y el conde Isouard, París 1858 (la «partida de la ópera»).",
    engineTestLink: "Diagnóstico del motor",
  },
  depth: {
    12: "Rápida (12)",
    16: "Normal (16)",
    20: "Profunda (20)",
  } as Record<number, string>,
  pgnError: {
    empty: "El PGN está vacío.",
    syntax: (line?: number, column?: number) =>
      line
        ? `No entiendo el PGN en la línea ${line}, columna ${column ?? "?"}.`
        : "No entiendo el PGN.",
    illegalMove: (move?: string, moveNumber?: number, line?: number) =>
      `La jugada ${moveNumber ? `${moveNumber}. ` : ""}«${move ?? "?"}» no es legal en esa posición` +
      (line ? ` (línea ${line}).` : "."),
    invalidFen: "La posición inicial (cabecera FEN) no es válida.",
  },
  analysis: {
    back: "Otra partida",
    white: "Blancas",
    black: "Negras",
    noGame: "No hay ninguna partida en el enlace.",
    badLink: "El enlace no contiene una partida válida.",
    goHome: "Pegar una partida",
    accuracy: "precisión",
    inaccuracies: (n: number) => `${n} ${n === 1 ? "imprecisión" : "imprecisiones"}`,
    mistakes: (n: number) => `${n} ${n === 1 ? "error" : "errores"}`,
    blunders: (n: number) => `${n} ${n === 1 ? "error grave" : "errores graves"}`,
    start: "Posición inicial",
    navHint: "Usa ← → Inicio Fin, pulsa una jugada o desliza sobre el tablero.",
    lossPrefix: "pierde",
    lossSuffix: "puntos de probabilidad de ganar",
    betterWas: "Mejor era",
    reasons: {
      "allows-mate": "permite un mate forzado",
      "lost-mate": "deja escapar un mate forzado",
    },
    engineLine: "Línea del motor",
    evaluation: "Evaluación",
    depthShort: "prof.",
    pending: "Pendiente de análisis…",
    first: "Inicio",
    prev: "Anterior",
    next: "Siguiente",
    last: "Final",
    flip: "Girar tablero",
    notation: "Notación",
    notationEs: "Española",
    notationEn: "Inglesa",
    depth: "Profundidad",
    reanalyze: "Reanalizar",
    graphTitle: "Curva de la partida",
    graphLabel: "Curva de evaluación. Pulsa para ir a una jugada.",
    movesLabel: "Planilla de jugadas",
    boardLabel: (fenText: string) => `Tablero: ${fenText}`,
    evalBarLabel: (text: string) => `Evaluación: ${text}`,
    copyLink: "Copiar enlace",
    copied: "Enlace copiado",
  },
  progress: {
    loadingEngine: "Cargando motor…",
    quick: (done: number, total: number) => `Pasada rápida (prof. 10): ${done} de ${total}`,
    full: (depth: number, done: number, total: number) =>
      `Profundidad ${depth}: ${done} de ${total}`,
    done: (depth: number, total: number) =>
      `Análisis completo · ${total} posiciones · prof. ${depth}`,
    engineError: "No se pudo cargar el motor en este navegador.",
    slowMode:
      "El motor va en modo lento (asm.js): tu navegador no ha podido cargar la versión WASM.",
  },
  diagnostics: {
    title: "Diagnóstico del motor",
    engine: "Motor",
    load: "Carga",
    speed: "Velocidad",
    perPosition: "Por posición",
    total: "Total",
  },
  classes: {
    best: { label: "Mejor jugada", symbol: "" },
    good: { label: "Buena", symbol: "" },
    inaccuracy: { label: "Imprecisión", symbol: "?!" },
    mistake: { label: "Error", symbol: "?" },
    blunder: { label: "Error grave", symbol: "??" },
    forced: { label: "Forzada", symbol: "" },
    book: { label: "Libro", symbol: "" },
  } satisfies Record<MoveClass, { label: string; symbol: string }>,
  engineTest: {
    title: "Prueba del motor",
    status: "Estado",
    loading: "Cargando motor…",
    ready: "readyok",
    error: "No se pudo cargar el motor en este navegador.",
    name: "Motor",
    build: "Build",
    buildWasm: "WASM · 1 hilo",
    buildAsm: "asm.js · 1 hilo (modo lento)",
    slowMode: "La build WASM no ha arrancado; el motor va en modo lento.",
    loadTime: "Tiempo de carga",
    back: "Volver al inicio",
  },
} as const;

export type Messages = typeof messages;

export function pgnErrorMessage(e: PgnError): string {
  const t = messages.pgnError;
  switch (e.kind) {
    case "empty":
      return t.empty;
    case "illegal-move":
      return t.illegalMove(e.moveText, e.moveNumber, e.line);
    case "invalid-fen":
      return t.invalidFen;
    case "syntax":
      return t.syntax(e.line, e.column);
  }
}
