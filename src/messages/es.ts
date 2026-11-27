// Single source of UI strings. Keep every user-facing text here so the UI can be translated later.
import type { PieceSymbol } from "chess.js";
import type { MoveClass } from "@/lib/chess/classify";
import type { Score } from "@/lib/chess/eval";
import { DESCRIBE_ORDER, type PositionDescription } from "@/lib/chess/describe";
import type { Explanation, PieceCounts } from "@/lib/chess/explain";
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
    train: "Entrenar",
    stats: "Estadísticas",
    about: "Acerca de",
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
  account: {
    title: "Cuenta",
    intro:
      "Con una cuenta puedes guardar tus análisis y verlos después en el historial. Sin cuenta puedes usar todo lo demás.",
    login: "Entrar",
    register: "Crear cuenta",
    recover: "Recuperar acceso",
    logout: "Salir",
    username: "Usuario",
    password: "Contraseña",
    newPassword: "Contraseña nueva",
    recoveryCode: "Código de recuperación",
    usernameHelp: "De 3 a 30 caracteres: letras, números, «_» y «-».",
    passwordHelp: "Mínimo 8 caracteres.",
    loggedInAs: (u: string) => `Has entrado como ${u}.`,
    goHistory: "Ver mi historial",
    codeTitle: "Guarda tu código de recuperación",
    codeText:
      "Es la única forma de recuperar la cuenta si olvidas la contraseña: no pedimos email. Solo se muestra ahora; guárdalo en un sitio seguro.",
    codeNewText: "Tu código anterior ya no vale. Este es el nuevo; guárdalo en un sitio seguro.",
    codeSaved: "Ya lo he guardado",
    copy: "Copiar",
    copied: "Copiado",
    noRecoveryWarning:
      "Si pierdes la contraseña y el código de recuperación, no podremos recuperar la cuenta.",
    errors: {
      "invalid-username":
        "El nombre de usuario no es válido (3–30 caracteres: letras, números, «_», «-»).",
      "invalid-password": "La contraseña debe tener entre 8 y 200 caracteres.",
      "username-taken": "Ese nombre de usuario ya existe.",
      "bad-credentials": "Usuario o contraseña incorrectos.",
      "bad-recovery": "Usuario o código de recuperación incorrectos.",
      "rate-limited": "Demasiados intentos. Espera unos minutos y vuelve a probar.",
      network: "No se pudo conectar con el servidor.",
      unknown: "Algo ha fallado. Vuelve a intentarlo.",
    } as Record<string, string>,
  },
  history: {
    title: "Historial",
    intro: "Tus análisis guardados.",
    loginNeeded: "Entra en tu cuenta para ver tu historial.",
    goLogin: "Entrar o crear cuenta",
    empty: "Todavía no has guardado ningún análisis.",
    open: "Abrir",
    remove: "Borrar",
    removeConfirm: "¿Seguro? Pulsa otra vez para borrar",
    loading: "Cargando…",
    error: "No se pudo cargar el historial.",
    depth: (d: number) => `prof. ${d}`,
    savedOn: (d: string) => `guardado el ${d}`,
  },
  save: {
    save: "Guardar en mi historial",
    saving: "Guardando…",
    saved: "Guardado en tu historial",
    error: "No se pudo guardar.",
    loginToSave: "Entra para guardar este análisis",
    colorLegend: "¿Con qué color jugabas?",
    colorWhite: "Blancas",
    colorBlack: "Negras",
    colorNone: "No jugué",
    colorHelp: "Tus errores se convertirán en ejercicios y contarán en tus estadísticas.",
    chooseColor: "Elige con qué color jugabas para guardar",
    waitAnalysis: "Espera a que termine el análisis para guardarlo",
  },
  train: {
    title: "Entrenar",
    intro:
      "Tus errores y errores graves, convertidos en ejercicios. Los que aciertas vuelven más tarde; los que fallas, mañana.",
    loginNeeded: "Entra en tu cuenta para entrenar con tus partidas guardadas.",
    goLogin: "Entrar o crear cuenta",
    none: "Todavía no tienes ejercicios. Guarda análisis indicando con qué color jugabas y tus errores aparecerán aquí.",
    allDone: (next: string | null) =>
      next
        ? `¡Al día! El próximo ejercicio toca el ${next}.`
        : "¡Al día! No tienes ejercicios pendientes.",
    progress: (done: number, due: number) => `Ejercicio ${done} de ${due}`,
    prompt: (side: string) => `Juegan ${side}. Encuentra la mejor jugada.`,
    white: "blancas",
    black: "negras",
    fromGame: (white: string, black: string, moveNumber: number) =>
      `De tu partida ${white} – ${black} (jugada ${moveNumber}).`,
    checking: "Comprobando tu jugada con el motor…",
    correct: "¡Correcto!",
    alsoGood: "¡Bien! No es la jugada del motor, pero también vale.",
    wrong: "No era esa.",
    solution: "La mejor era",
    youPlayed: "En la partida jugaste",
    lossNote: (n: number) => `Tu jugada pierde ${n} puntos de probabilidad de ganar.`,
    next: "Siguiente",
    showSolution: "Ver solución",
    typeMove: "O escribe tu jugada",
    typeMoveHelp: (example: string) => `En notación algebraica, por ejemplo ${example}.`,
    submitMove: "Comprobar",
    illegalMove: "Esa jugada no es legal en esta posición.",
    boardLabel: (side: string) =>
      `Tablero del ejercicio; juegan ${side}. Puedes mover piezas arrastrándolas o con el teclado.`,
    box: (n: number) => `Caja ${n} de 5`,
    error: "No se pudieron cargar los ejercicios.",
    loading: "Cargando…",
  },
  statsPage: {
    title: "Estadísticas",
    intro: "Calculadas con tus análisis guardados en los que indicaste con qué color jugabas.",
    loginNeeded: "Entra en tu cuenta para ver tus estadísticas.",
    goLogin: "Entrar o crear cuenta",
    empty: "Todavía no hay datos. Guarda análisis indicando con qué color jugabas.",
    loading: "Cargando…",
    error: "No se pudieron cargar las estadísticas.",
    summary: (games: number, moves: number) =>
      `${games} ${games === 1 ? "partida" : "partidas"} · ${moves} ${moves === 1 ? "jugada tuya analizada" : "jugadas tuyas analizadas"}`,
    phasesTitle: "Precisión por fase de la partida",
    phases: { opening: "Apertura", middlegame: "Medio juego", endgame: "Final" },
    phaseNote:
      "Fases según el material sin peones (D 9, T 5, A y C 3; 62 al empezar): apertura hasta la jugada 10 con 52 o más; final con 26 o menos; medio juego el resto.",
    accuracy: "Precisión",
    moves: "Jugadas",
    openingsTitle: "Aperturas con peor resultado",
    opening: "Apertura",
    games: "Partidas",
    record: "+ / = / −",
    score: "Puntos",
    unknownOpening: "Sin identificar",
    errorsTitle: "Tus errores más frecuentes",
    errorsNote: (n: number) =>
      `${n} ${n === 1 ? "error o error grave" : "errores y errores graves"} en total (las imprecisiones no cuentan).`,
    byKind: "Por tipo",
    byPhase: "Por fase",
    byPiece: "Por pieza movida",
    kinds: {
      "allows-mate": "Permitir un mate",
      "lost-mate": "Dejar escapar un mate",
      hanging: "Dejar una pieza a merced del rival",
      "loses-material": "Perder material en una secuencia",
      "missed-tactic": "No ver una táctica ganadora",
      "eval-swing": "Errores posicionales",
    },
    pieces: { k: "Rey", q: "Dama", r: "Torre", b: "Alfil", n: "Caballo", p: "Peón" },
  },
  exportReport: {
    share: "Compartir",
    download: "Descargar imagen",
    waitAnalysis: "Espera a que termine el análisis",
    error: "No se pudo exportar.",
    counts: (i: number, m: number, b: number) =>
      [
        `${i} ${i === 1 ? "imprecisión" : "imprecisiones"}`,
        `${m} ${m === 1 ? "error" : "errores"}`,
        `${b} ${b === 1 ? "error grave" : "errores graves"}`,
      ].join(" · "),
    footer: (host: string) => `Analizado con Stockfish en el navegador · ${host}`,
  },
  about: {
    title: "Acerca de",
    intro:
      "Un analizador de partidas de ajedrez gratuito y de código abierto: analiza tus partidas con Stockfish dentro de tu navegador y te explica dónde te equivocaste.",
    privacyTitle: "Privacidad",
    privacy: [
      "El motor de ajedrez se ejecuta en tu dispositivo. El servidor nunca analiza tus partidas.",
      "Sin cuenta no guardamos nada: el borrador del PGN, tus preferencias y la caché de análisis viven solo en tu navegador.",
      "Con cuenta guardamos tu nombre de usuario, un hash de tu contraseña (scrypt) y los análisis que tú decidas guardar. No pedimos email.",
      "Al importar partidas, tu navegador consulta directamente las APIs públicas de Lichess o Chess.com.",
    ],
    licenseTitle: "Licencia",
    license:
      "Este programa es software libre: puedes redistribuirlo y modificarlo bajo los términos de la Licencia Pública General de GNU, versión 3 (GPL-3.0).",
    source: "Código fuente",
    creditsTitle: "Créditos",
    credits: [
      [
        "Stockfish",
        "https://stockfishchess.org/",
        "Motor de ajedrez. © Los desarrolladores de Stockfish. GPL-3.0.",
      ],
      [
        "stockfish.js",
        "https://github.com/nmrugg/stockfish.js",
        "Stockfish en WebAssembly, de Nathan Rugg y Chess.com. GPL-3.0. Se distribuye sin modificar.",
      ],
      [
        "lichess-org/chess-openings",
        "https://github.com/lichess-org/chess-openings",
        "Nombres y códigos ECO de las aperturas. CC0-1.0.",
      ],
      ["chess.js", "https://github.com/jhlywa/chess.js", "Reglas del ajedrez y PGN. BSD-2-Clause."],
      ["react-chessboard", "https://github.com/Clariity/react-chessboard", "Tablero. MIT."],
      [
        "Lichess",
        "https://lichess.org/",
        "Fórmula de probabilidad de victoria y método de precisión, adaptados de su código abierto (AGPL); API pública de partidas.",
      ],
      [
        "Chess.com",
        "https://www.chess.com/news/view/published-data-api",
        "API pública de partidas.",
      ],
    ] as [string, string, string][],
    depsTitle: "Dependencias de producción",
    depsIntro: (n: number) =>
      `${n} paquetes, generados automáticamente con pnpm licenses en cada build.`,
    depName: "Paquete",
    depVersion: "Versión",
    depLicense: "Licencia",
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
    explanation: "Explicación",
    describe: "Descripción de la posición",
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

const PIECES: Record<PieceSymbol, { one: string; many: string; fem: boolean }> = {
  p: { one: "peón", many: "peones", fem: false },
  n: { one: "caballo", many: "caballos", fem: false },
  b: { one: "alfil", many: "alfiles", fem: false },
  r: { one: "torre", many: "torres", fem: true },
  q: { one: "dama", many: "damas", fem: true },
  k: { one: "rey", many: "reyes", fem: false },
};
const NUMBERS = ["", "", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho"];
const ORDER: PieceSymbol[] = ["q", "r", "b", "n", "p"];

/** {n: 1, p: 2} → "un caballo y dos peones". */
export function describePieces(c: PieceCounts): string {
  const parts = ORDER.filter((p) => (c[p] ?? 0) > 0).map((p) => {
    const n = c[p] ?? 0;
    const name = PIECES[p];
    return n === 1 ? `${name.fem ? "una" : "un"} ${name.one}` : `${NUMBERS[n] ?? n} ${name.many}`;
  });
  if (parts.length === 0) return "material";
  return parts.length === 1
    ? (parts[0] as string)
    : `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

/** Text of a rule-based explanation. `line` numbers/translates SAN from a FEN; `score` formats evals. */
export function explanationText(
  e: Explanation,
  line: (fen: string, san: readonly string[]) => string,
  score: (s: Score) => string,
): string {
  switch (e.kind) {
    case "allows-mate":
      return e.mateIn === 1
        ? `Permite mate inmediato: ${line(e.fen, e.line)}.`
        : `Permite mate en ${e.mateIn}: ${line(e.fen, e.line)}.`;
    case "lost-mate":
      return `Había mate en ${e.mateIn} empezando con ${line(e.fen, [e.best])}; tras esta jugada ya no.`;
    case "hanging": {
      const p = PIECES[e.piece];
      return `El rival se lleva tu ${p.one} de ${e.square} con ${line(e.fen, [e.capture])}.`;
    }
    case "loses-material": {
      const gained = Object.keys(e.gained).length ? ` a cambio de ${describePieces(e.gained)}` : "";
      return `Pierdes material: tras ${line(e.fen, e.line)}, el rival gana ${describePieces(e.lost)}${gained}.`;
    }
    case "missed-tactic":
      return `Se te escapa ${line(e.fen, [e.best])}, que gana ${describePieces(e.won)}.`;
    case "eval-swing":
      return `La evaluación pasa de ${score(e.before)} a ${score(e.after)}; ${line(e.fen, [e.best])} era mejor.`;
  }
}

const PIECE_NAMES: Record<PieceSymbol, [string, string]> = {
  k: ["Rey", "Rey"],
  q: ["Dama", "Damas"],
  r: ["Torre", "Torres"],
  b: ["Alfil", "Alfiles"],
  n: ["Caballo", "Caballos"],
  p: ["Peón", "Peones"],
};

const list = (xs: readonly string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`;

/** "Blancas: Rey en g1; Dama en d1; Torres en a1 y f1; … Juegan negras." */
export function positionText(d: PositionDescription): string {
  const side = (c: "w" | "b") => {
    const parts = DESCRIBE_ORDER.flatMap((p) => {
      const sq = d[c].pieces[p];
      if (!sq?.length) return [];
      const [one, many] = PIECE_NAMES[p];
      return [`${sq.length === 1 ? one : many} en ${list(sq)}`];
    });
    return `${c === "w" ? "Blancas" : "Negras"}: ${parts.join("; ")}.`;
  };
  const state = d.checkmate
    ? `Jaque mate: ganan ${d.turn === "w" ? "negras" : "blancas"}.`
    : d.stalemate
      ? "Rey ahogado: tablas."
      : `Juegan ${d.turn === "w" ? "blancas" : "negras"}${d.check ? ", en jaque" : ""}.`;
  return `${side("w")} ${side("b")} ${state}`;
}

/** Accessible name of a piece on the board: "Caballo negro en f6". */
export function pieceLabel(type: PieceSymbol, color: "w" | "b", square: string): string {
  const name = PIECE_NAMES[type][0];
  const fem = type === "q" || type === "r";
  const colour = color === "w" ? (fem ? "blanca" : "blanco") : fem ? "negra" : "negro";
  return `${name} ${colour} en ${square}`;
}
