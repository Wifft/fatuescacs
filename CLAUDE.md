# CLAUDE.md

Analizador de partidas de ajedrez en el navegador. La especificación completa (fases, umbrales, arquitectura) la da el usuario fase a fase; la prueba de concepto de referencia está en `poc/index.html` (no copiarla tal cual).

@AGENTS.md

## Comandos

- `pnpm install` — instala y copia el motor a `public/engine/` (`scripts/copy-engine.mjs`, postinstall)
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` · `pnpm format` / `pnpm format:check` · `pnpm typecheck` (`next typegen && tsc --noEmit`)
- `pnpm test` (Vitest, `tests/unit`, `tests/golden`) · `pnpm test:e2e` (Playwright, Chromium, puerto 3100, hace build)
- `pnpm golden:record [filtro]` — regraba las evaluaciones de `tests/golden/evals/` con Stockfish en Node (prof. 16, ~3,5 min). `pnpm golden:expected [filtro]` — reescribe `tests/golden/expected/` desde las evaluaciones grabadas. **Revisar a mano el diff de `expected/` antes de commitearlo.**
- `pnpm openings:build` — regenera `public/openings.json` (descarga los TSV de lichess-org/chess-openings; el resultado se commitea).
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

## Arquitectura

- `lib/chess`: `pgn.ts` (PGN → posiciones, errores `PgnError` con línea/jugada), `eval.ts` (`Score` en perspectiva de blancas, probabilidad de victoria Lichess, formateo, posiciones terminales), `classify.ts` (`CLASSIFY_THRESHOLDS` + correcciones 1–4), `accuracy.ts`, `report.ts` (clases + precisión + recuentos), `line.ts`, `notation.ts`.
- `lib/engine`: `uci.ts` (parser puro), `engine.ts` (`Engine` sobre un `EngineTransport`: cola serializada, cancelación con `AbortSignal` → `stop` → espera `bestmove`), `analyzer.ts` (pasada rápida a prof. 10 + pasada a la profundidad elegida, `EvalCache` por FEN + profundidad), `browser.ts` (un Worker por pestaña, perezoso), `boot.ts`.
- `store/`: zustand (`analysis.ts`), `run-analysis.ts` (lanza/cancela el análisis), `use-report.ts`.
- URL compartible: `/analysis#<PGN comprimido con lz-string>` (`lib/share.ts`). Nada en query strings.

## Fase 2: importación, aperturas, cuentas

- **Importación** (`lib/import/`), todo desde el navegador, sin proxy. CORS verificado el 2026-11-27 con `fetch` real desde Chromium.
  - Lichess: `GET /api/games/user/{u}?max=20&pgnInJson=true&opening=true` con `Accept: application/x-ndjson`. Responde **404 tanto si el usuario no existe como si no tiene partidas**; se distingue con `/api/user/{u}`.
  - Chess.com: `/pub/player/{u}/games/archives` y luego meses hacia atrás (máx. 3). Incluye Chess960 (`rules`), que se filtra. `curl` recibe 403 (antibots), pero el navegador no.
  - `PoliteHttp`: una petición cada vez, reintentos con espera creciente, 60 s tras un 429 y caché de 5 min. El navegador no deja fijar `User-Agent`.
  - Tests con respuestas reales grabadas en `tests/unit/fixtures/`.
- **Aperturas:** `public/openings.json` (EPD → [ECO, nombre] o 0 si es una posición intermedia; 85 KB gzip, carga perezosa). Las jugadas de **Libro** van de forma contigua desde el inicio mientras la posición esté en la tabla. No cuentan para la precisión y la jugada forzada tiene prioridad. Los golden tests no usan libro.
- **Caché de evaluaciones:** `IdbEvalCache` (IndexedDB + memoria). Si hay una evaluación a la profundidad final, la pasada rápida la reutiliza; así se reabre el historial al instante.
- **Backend SQLite** (`src/server/`, solo servidor; lo usan los route handlers de `src/app/api/`):
  - `node:sqlite`, fichero `DB_PATH` (por defecto `data/fatuescacs.db`, en `.gitignore`); migraciones en `server/migrations.ts` con `PRAGMA user_version` (**nunca editar una migración publicada**, añadir otra).
  - En `getDb()`, `resolve(/*turbopackIgnore: true*/ …)` evita que Turbopack trace todo el proyecto.
  - Cuentas: usuario y contraseña con scrypt; código de recuperación (se muestra una vez y rota al usarse; recuperar cierra todas las sesiones).
  - Sesiones con token aleatorio guardado como SHA-256, en una cookie `fc_session` httpOnly + SameSite=Lax (+ Secure en producción salvo `INSECURE_COOKIES=1`), 30 días.
  - CSRF: las peticiones que cambian estado exigen que `Origin` coincida con el host, y además JSON.
  - Límite de intentos en memoria: 5 cada 15 min por IP + usuario, y 10 registros por hora por IP.
  - Análisis guardados: el servidor valida y **recalcula** el resumen con `buildReport`; hay uno por usuario y PGN (upsert).
- **e2e:** `DB_PATH=.e2e/e2e.db`. `tests/e2e/helpers.ts` bloquea toda petición fuera de localhost, y las APIs externas se simulan con `page.route`.

## Fase 3: explicaciones, entrenamiento, estadísticas

- **Explicaciones automáticas, sin IA** (`lib/chess/explain.ts`; decisión del usuario, 2026-11-27: de momento no se usa la API de Anthropic).
  - Función pura que devuelve datos estructurados; el texto está en `explanationText` de `messages/es.ts`.
  - Solo describe líneas del motor. Por prioridad:
    1. `allows-mate`;
    2. `lost-mate`;
    3. `hanging`: la primera respuesta del rival gana una pieza de 3 o más. Se redacta como «el rival se lleva tu X», porque la pieza podía estar atacada ya antes de la jugada;
    4. `loses-material`;
    5. `missed-tactic`;
    6. `eval-swing`.
  - El material se mide con `forcingLine`: se rejuega la línea mientras haya capturas, jaques o coronaciones (máx. 6 jugadas), y por debajo de 2 peones no se considera pérdida de material.
- **Color del usuario:** al guardar se elige blancas, negras o «no jugué» (migración 2, `analyses.user_color`). Se preselecciona si el nombre coincide con el último usuario importado (`localStorage["import-last"]`). Sin color no hay ejercicios ni estadísticas.
- **Ejercicios** (`server/drills.ts`, tabla `drills`):
  - salen de los errores y errores graves del usuario y se sincronizan al guardar: los nuevos quedan pendientes ya, y los existentes conservan su caja;
  - sistema Leitner con cajas 1–5 e intervalos de 1/3/7/14/30 días; un fallo vuelve a la caja 1;
  - corrección en el navegador (`lib/chess/drill-check.ts`): la jugada del motor vale siempre, y otra vale si pierde menos de 5 puntos según el motor a prof. 14.
- **Estadísticas** (`lib/chess/stats.ts`, `GET /api/stats`):
  - fase por material sin peones (D 9, T 5, A/C 3; 62 al inicio): apertura con menos de 20 jugadas y 52 o más, final con 26 o menos, medio juego el resto;
  - la precisión por fase es la media simple de la precisión por jugada;
  - las aperturas se ordenan de peor a mejor (puntos y luego precisión);
  - los errores se agrupan por tipo de explicación, por fase y por pieza.
- **e2e:** para arrastrar piezas en react-chessboard (dnd-kit) hay que mover el ratón en varios pasos (`page.mouse`); `dragTo` no basta. Las casillas llevan `data-square`. `registerUser` está en `tests/e2e/helpers.ts`: no importar entre specs.

## Fase 4 (en curso)

- **Accesibilidad:** los textos con color de clase usan las variables `--c-*-text` (AA ≥ 4.5:1); las marcas usan `--c-*`. El tablero del análisis es `inert`, con una descripción textual (`lib/chess/describe.ts`). En el entrenamiento, `usePieceLabels` da nombre a las piezas de react-chessboard y se puede escribir la jugada. Los formularios renderizados en el servidor quedan en `<fieldset disabled>` hasta hidratar (`useHydrated`). axe corre en `tests/e2e/a11y.spec.ts`.
- **PWA:** `app/manifest.ts` y `public/sw.js`, escrito a mano. En los e2e el service worker está bloqueado, salvo en `pwa.spec.ts`.
- **Licencias:** `src/generated/licenses.json` se genera en postinstall y prebuild (`scripts/build-licenses.mjs`).
- **Multihilo descartado** (medido el 2026-11-27 con 82 posiciones a prof. 16, Snapdragon X de 12 núcleos):
  - build actual (1 hilo): 54,3 s;
  - build multihilo con 1 hilo: 48,1 s;
  - con 2 hilos: 137,3 s; con 4 hilos: 326,9 s.

  Con `go depth`, más hilos (Lazy SMP) tardan más en llegar a la misma profundidad. La mejora del 11 % no justifica exigir COOP/COEP.

- **Docker:** el `Dockerfile` no se ha podido probar aquí porque no hay Docker instalado.

## Motor

- Build principal: `/engine/stockfish-19-lite-single.js` (+ `.wasm`, 1,8 MB / 1,2 MB gzip). Fallback: `/engine/stockfish-19-asm.js` (modo lento).
- El worker localiza su `.wasm` cambiando `.js` → `.wasm` en su propia URL (o el primer elemento del hash de la URL del worker).
- `next.config.ts` fija `Content-Type: application/wasm` y `Cache-Control: max-age=86400` (los nombres no llevan hash; no usar `immutable`).
- En Node (`scripts/record-golden.mts`): `require("stockfish")("lite-single", onLine)` con `processCommand`/`terminate`.

## Decisiones tomadas

- **Stack, cambio respecto a la spec original:** SQLite (`node:sqlite`) en lugar de Supabase, con cuentas de usuario y contraseña en vez de enlace mágico (decisión del usuario, 2026-11-27). El hosting tiene que ser un proceso Node persistente con disco.
- Repo público en GitHub: `Wifft/fatuescacs`. CI en GitHub Actions (`.github/workflows/ci.yml`): lint, typecheck, unit, e2e.
- **Sin Vercel** ni despliegues de preview (decisión del usuario, 2026-11-27). Hosting pendiente de decidir.
- pnpm 10 (Node 26 ya no trae corepack; instalado con `npm i -g pnpm@10`). Node 26 en `.nvmrc`.
- Licencia GPL-3.0 (`LICENSE`). Dependencias de producción revisadas: todas compatibles.
- Sin Google Fonts: pila de fuentes del sistema (evita red en build/tests).
- **Presupuesto de bundle: 1 MB gzip** de JS inicial (decisión del usuario, 2026-11-27; antes 200 KB). Medido en fase 2: `/` 192 KB, `/analysis` 222 KB, `/import` 194 KB, `/cuenta` 179 KB, `/historial` 195 KB.
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
