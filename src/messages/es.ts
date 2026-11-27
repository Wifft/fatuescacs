// Single source of UI strings. Keep every user-facing text here so the UI can be translated later.
export const messages = {
  app: {
    title: "Analizador de partidas",
    tagline: "Analiza tus partidas de ajedrez con Stockfish, dentro de tu navegador.",
  },
  home: {
    phaseNote: "Fase 0: cimientos. El análisis de partidas llega en la fase 1.",
    engineTestLink: "Probar el motor",
  },
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
