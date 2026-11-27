# Analizador de partidas de ajedrez

Aplicación web que analiza tus partidas de ajedrez con Stockfish y te explica dónde te equivocaste. El motor corre **en tu navegador** (WebAssembly en un Web Worker): el servidor nunca analiza nada y tus partidas no salen de tu equipo.

> Estado: **fase 4** (PWA instalable, análisis sin conexión, exportar informe, accesibilidad AA). Analiza un PGN o importa tus partidas de Lichess y Chess.com, con la apertura identificada y una explicación automática de cada error basada en las líneas del motor. Con cuenta (opcional), guarda tus análisis, entrena con tus propios errores (repetición espaciada) y consulta tus estadísticas. La prueba de concepto original está en [`poc/index.html`](poc/index.html).

## Requisitos

- Node.js 26 (ver `.nvmrc`)
- pnpm 10 (`npm i -g pnpm@10`)

## Arrancar el proyecto

```bash
pnpm install        # el postinstall copia el motor a public/engine/
pnpm dev            # http://localhost:3000
```

Abre <http://localhost:3000>, pega una partida y pulsa «Analizar», o importa tus partidas en «Importar». En <http://localhost:3000/dev/engine> puedes comprobar que Stockfish arranca (debe mostrar `readyok`).

## Datos y configuración

Las cuentas y el historial se guardan en un fichero SQLite (`node:sqlite`, incluido en Node 26; sin servicios externos). El servidor debe ejecutarse como un proceso Node persistente con disco escribible.

| Variable           | Por defecto          | Para qué                                                               |
| ------------------ | -------------------- | ---------------------------------------------------------------------- |
| `DB_PATH`          | `data/fatuescacs.db` | Ruta del fichero SQLite (se crea solo, con sus migraciones)            |
| `INSECURE_COOKIES` | —                    | `1` para servir la build de producción por HTTP sin TLS (solo pruebas) |

Se guardan nombres de usuario, hashes de contraseña (scrypt) y los análisis que cada usuario decide guardar. No se guardan emails.

## Despliegue con Docker

```bash
docker build -t fatuescacs .
docker run -p 3000:3000 -v fatuescacs-data:/data fatuescacs
```

SQLite vive en el volumen `/data`. Sirve la app detrás de HTTPS: en producción la cookie de sesión es `Secure`. Solo para pruebas por HTTP, añade `-e INSECURE_COOKIES=1`.

## Comandos

| Comando                | Qué hace                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev`             | Servidor de desarrollo                                                         |
| `pnpm build`           | Build de producción                                                            |
| `pnpm start`           | Sirve la build de producción                                                   |
| `pnpm lint`            | ESLint                                                                         |
| `pnpm format`          | Formatea con Prettier (`format:check` solo comprueba)                          |
| `pnpm typecheck`       | Genera los tipos de rutas y ejecuta `tsc --noEmit`                             |
| `pnpm test`            | Tests unitarios (Vitest)                                                       |
| `pnpm test:e2e`        | Tests end-to-end (Playwright; hace build y arranca)                            |
| `pnpm golden:record`   | Regraba las evaluaciones de los golden tests (Stockfish en Node)               |
| `pnpm golden:expected` | Regenera los resultados esperados de los golden tests                          |
| `pnpm bench`           | Mide el análisis de una partida de 41 jugadas en Chromium                      |
| `pnpm lighthouse`      | Lighthouse (mediana de 3) contra un servidor arrancado; falla por debajo de 90 |
| `pnpm openings:build`  | Regenera `public/openings.json` desde lichess-org/chess-openings               |

La primera vez que lances los e2e: `pnpm exec playwright install chromium`.

## Licencia y créditos

Este proyecto es software libre bajo la licencia **GPL-3.0** (ver [`LICENSE`](LICENSE)).

- [Stockfish](https://stockfishchess.org/) — motor de ajedrez, © los desarrolladores de Stockfish, GPL-3.0.
- [stockfish.js](https://github.com/nmrugg/stockfish.js) — port de Stockfish a WebAssembly/JavaScript, de Nathan Rugg y Chess.com, GPL-3.0. Se distribuye sin modificar desde el paquete npm `stockfish`.
- [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) — nombres y códigos ECO de aperturas, CC0-1.0.
