# CLAUDE.md

Analizador de partidas de ajedrez en el navegador. La especificación completa (fases, umbrales, arquitectura) la da el usuario fase a fase; la prueba de concepto de referencia está en `poc/index.html` (no copiarla tal cual).

@AGENTS.md

## Comandos

- `pnpm install` — instala y copia el motor a `public/engine/` (`scripts/copy-engine.mjs`, postinstall)
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` · `pnpm format` / `pnpm format:check` · `pnpm typecheck` (`next typegen && tsc --noEmit`)
- `pnpm test` (Vitest, `tests/unit`, `tests/golden`) · `pnpm test:e2e` (Playwright, Chromium, puerto 3100, hace build)
- Antes de dar algo por terminado: lint, format:check, typecheck, test y test:e2e en verde. No desactivar tests.

## Convenciones

- UI en español; código, identificadores y comentarios de código en inglés.
- Todos los textos de UI en `src/messages/es.ts`.
- Commits pequeños en español: `tipo: descripción` (`feat`, `fix`, `test`, `refactor`, `docs`, `chore`). Una rama por fase (`fase-N`) y PR al terminar.
- Lógica de ajedrez/motor = funciones puras en `src/lib/**`, sin dependencias de UI, con tests unitarios.
- Puntuaciones UCI: normalizar **siempre a perspectiva de blancas** al parsear.
- Ningún test usa red externa real.
- Next.js 16.4: es distinto a versiones anteriores; consultar `node_modules/next/dist/docs/` antes de usar APIs (ver AGENTS.md). `cacheComponents` está activo.
- TS estricto con `noUncheckedIndexedAccess`.

## Motor

- Build principal: `/engine/stockfish-19-lite-single.js` (+ `.wasm`, 1,8 MB / 1,2 MB gzip). Fallback: `/engine/stockfish-19-asm.js` (modo lento).
- El worker localiza su `.wasm` cambiando `.js` → `.wasm` en su propia URL (o el primer elemento del hash de la URL del worker).
- `next.config.ts` fija `Content-Type: application/wasm` y `Cache-Control: max-age=86400` (los nombres no llevan hash; no usar `immutable`).
- Arranque y handshake: `src/lib/engine/boot.ts`; parseo UCI puro: `src/lib/engine/uci.ts`. Página de prueba: `/dev/engine`.

## Decisiones tomadas

- Repo público en GitHub: `Wifft/fatuescacs`. CI en GitHub Actions (`.github/workflows/ci.yml`): lint, typecheck, unit, e2e.
- **Sin Vercel** ni despliegues de preview (decisión del usuario, 2026-11-27). Hosting pendiente de decidir.
- pnpm 10 (Node 26 ya no trae corepack; instalado con `npm i -g pnpm@10`). Node 26 en `.nvmrc`.
- Licencia GPL-3.0 (`LICENSE`). Dependencias de producción revisadas: todas compatibles.
- Sin Google Fonts: pila de fuentes del sistema (evita red en build/tests).
- Base de JS inicial (Next 16 + React 19, sin código propio relevante): ~173 KB gzip. El presupuesto de la fase 4 es 200 KB.
