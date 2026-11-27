# Analizador de partidas de ajedrez

Aplicación web que analiza tus partidas de ajedrez con Stockfish y te explica dónde te equivocaste. El motor corre **en tu navegador** (WebAssembly en un Web Worker): el servidor nunca analiza nada y tus partidas no salen de tu equipo.

> Estado: **fase 0 (cimientos)**. El análisis de partidas llega en la fase 1. La prueba de concepto original está en [`poc/index.html`](poc/index.html).

## Requisitos

- Node.js 26 (ver `.nvmrc`)
- pnpm 10 (`npm i -g pnpm@10`)

## Arrancar el proyecto

```bash
pnpm install        # el postinstall copia el motor a public/engine/
pnpm dev            # http://localhost:3000
```

Abre <http://localhost:3000/dev/engine> para comprobar que Stockfish arranca (debe mostrar `readyok`).

## Comandos

| Comando          | Qué hace                                              |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo                                |
| `pnpm build`     | Build de producción                                   |
| `pnpm start`     | Sirve la build de producción                          |
| `pnpm lint`      | ESLint                                                |
| `pnpm format`    | Formatea con Prettier (`format:check` solo comprueba) |
| `pnpm typecheck` | Genera los tipos de rutas y ejecuta `tsc --noEmit`    |
| `pnpm test`      | Tests unitarios (Vitest)                              |
| `pnpm test:e2e`  | Tests end-to-end (Playwright; hace build y arranca)   |

La primera vez que lances los e2e: `pnpm exec playwright install chromium`.

## Licencia y créditos

Este proyecto es software libre bajo la licencia **GPL-3.0** (ver [`LICENSE`](LICENSE)).

- [Stockfish](https://stockfishchess.org/) — motor de ajedrez, © los desarrolladores de Stockfish, GPL-3.0.
- [stockfish.js](https://github.com/nmrugg/stockfish.js) — port de Stockfish a WebAssembly/JavaScript, de Nathan Rugg y Chess.com, GPL-3.0. Se distribuye sin modificar desde el paquete npm `stockfish`.
