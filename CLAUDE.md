# CLAUDE.md

Analizador de partidas de ajedrez en el navegador. La especificación completa (fases, umbrales, arquitectura) la da el usuario fase a fase; la prueba de concepto de referencia está en `poc/index.html` (no copiarla tal cual).

@AGENTS.md

## Comandos

- `pnpm install` — instala y copia el motor a `public/engine/` (`scripts/copy-engine.mjs`, postinstall)
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` · `pnpm format` / `pnpm format:check` · `pnpm typecheck` (`next typegen && tsc --noEmit`)
- `pnpm test` (Vitest, `tests/unit`, `tests/golden`) · `pnpm test:e2e` (Playwright, Chromium, puerto 3100, hace build)
- `pnpm golden:record [filtro]` — regraba las evaluaciones de `tests/golden/evals/` con Stockfish en Node (prof. 16, ~3,5 min). `pnpm golden:expected [filtro]` — reescribe `tests/golden/expected/` desde las evaluaciones grabadas. **Revisar a mano el diff de `expected/` antes de commitearlo.**
- `pnpm bench [url] [prof] [--hidden]` — mide el análisis de Byrne–Fischer (41 jugadas) en Chromium contra un servidor ya arrancado. `--hidden` abre una ventana real para medir una pestaña en segundo plano.
- Antes de dar algo por terminado: lint, format:check, typecheck, test y test:e2e en verde. No desactivar tests.

## Convenciones

- UI en español; código, identificadores y comentarios de código en inglés.
- Todos los textos de UI en `src/messages/es.ts`.
- Commits pequeños en español: `tipo: descripción` (`feat`, `fix`, `test`, `refactor`, `docs`, `chore`). Una rama por fase (`fase-N`) y PR al terminar.
- Lógica de ajedrez/motor = funciones puras en `src/lib/**`, sin dependencias de UI, con tests unitarios.
- Puntuaciones UCI: normalizar **siempre a perspectiva de blancas** al parsear (`normalizeUciScore` en `lib/chess/eval.ts`; `mate 0` → resultado).
- Internamente todo va en SAN inglesa y UCI; la notación española (`lib/chess/notation.ts`) es solo de visualización.
- Ningún test usa red externa real. Los golden tests usan evaluaciones grabadas, nunca el motor en vivo.
- Next.js 16.4: es distinto a versiones anteriores; consultar `node_modules/next/dist/docs/` antes de usar APIs (ver AGENTS.md). `cacheComponents` está activo.
- TS estricto con `noUncheckedIndexedAccess`. Los scripts en TS que importan `src/lib` son `.mts` y se ejecutan con `tsx`.

## Arquitectura (fase 1)

- `lib/chess`: `pgn.ts` (PGN → posiciones, errores `PgnError` con línea/jugada), `eval.ts` (`Score` en perspectiva de blancas, probabilidad de victoria Lichess, formateo, posiciones terminales), `classify.ts` (`CLASSIFY_THRESHOLDS` + correcciones 1–4), `accuracy.ts`, `report.ts` (clases + precisión + recuentos), `line.ts`, `notation.ts`.
- `lib/engine`: `uci.ts` (parser puro), `engine.ts` (`Engine` sobre un `EngineTransport`: cola serializada, cancelación con `AbortSignal` → `stop` → espera `bestmove`), `analyzer.ts` (pasada rápida a prof. 10 + pasada a la profundidad elegida, `EvalCache` por FEN + profundidad), `browser.ts` (un Worker por pestaña, perezoso), `boot.ts`.
- `store/`: zustand (`analysis.ts`), `run-analysis.ts` (lanza/cancela el análisis), `use-report.ts`.
- URL compartible: `/analysis#<PGN comprimido con lz-string>` (`lib/share.ts`). Nada en query strings.

## Motor

- Build principal: `/engine/stockfish-19-lite-single.js` (+ `.wasm`, 1,8 MB / 1,2 MB gzip). Fallback: `/engine/stockfish-19-asm.js` (modo lento).
- El worker localiza su `.wasm` cambiando `.js` → `.wasm` en su propia URL (o el primer elemento del hash de la URL del worker).
- `next.config.ts` fija `Content-Type: application/wasm` y `Cache-Control: max-age=86400` (los nombres no llevan hash; no usar `immutable`).
- En Node (`scripts/record-golden.mts`): `require("stockfish")("lite-single", onLine)` con `processCommand`/`terminate`.

## Decisiones tomadas

- Repo público en GitHub: `Wifft/fatuescacs`. CI en GitHub Actions (`.github/workflows/ci.yml`): lint, typecheck, unit, e2e.
- **Sin Vercel** ni despliegues de preview (decisión del usuario, 2026-11-27). Hosting pendiente de decidir.
- pnpm 10 (Node 26 ya no trae corepack; instalado con `npm i -g pnpm@10`). Node 26 en `.nvmrc`.
- Licencia GPL-3.0 (`LICENSE`). Dependencias de producción revisadas: todas compatibles.
- Sin Google Fonts: pila de fuentes del sistema (evita red en build/tests).
- **Presupuesto de bundle: 1 MB gzip** de JS inicial (decisión del usuario, 2026-11-27; antes 200 KB). Medido en fase 1: `/` 190 KB, `/analysis` 219 KB.
- Clasificación:
  - "Mejor" = coincide con el `bestmove` de la posición anterior, o da mate.
  - Correcciones de la spec, en este orden: posición perdida (bajar un nivel) → sigue ganando (máx. Buena salvo mate perdido) → mates (mantiene mate: máx. Buena; pierde mate: mín. Error; permite mate nuevo: Error grave, incluso en posición perdida).
  - Las clases con mate llevan `reason` para explicarlo en la UI.
- Precisión: método de Lichess verificado en el código fuente de lila/scalalib (2026-11-27):
  - ventanas de volatilidad con desviación típica poblacional limitada a [0,5, 12];
  - media ponderada + media armónica con `max(1, v)`, promediadas.
  - Desviaciones deliberadas: fórmula por jugada de la spec, sin el "+1" de Lichess; mates = 100/0; las jugadas forzadas no cuentan.
- Golden tests: 13 partidas en `tests/golden/games/`. `expected/` es una instantánea revisada a mano, más aserciones explícitas en `golden.test.ts` (15. Axd7+ de la ópera no es Error). La precisión tiene una tolerancia de ±0,5.
- Pestañas en segundo plano: el bucle de análisis lo mueven los mensajes del Worker, no temporizadores del hilo principal. No se ha podido medir en headless (siempre `visible`); queda pendiente medirlo con `pnpm bench --hidden`.
