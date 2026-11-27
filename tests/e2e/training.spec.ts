import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { toSpanishSan } from "../../src/lib/chess/notation";
import { blockExternalNetwork, registerUser, uniqueName } from "./helpers";

// Short game: as White, 5... Bxd1?? is Black's blunder; as Black we get drills from Black's moves.
const LEGAL = `[White "Legall"]
[Black "Saint Brie"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

async function analyseAndSaveAsBlack(page: Page) {
  await page.goto("/");
  await page.getByTestId("pgn-input").fill(LEGAL);
  await page.getByLabel("Profundidad").selectOption("12");
  await page.getByTestId("analyze").click();
  await expect(page.getByTestId("progress-text")).toHaveAttribute("data-phase", "done", {
    timeout: 60_000,
  });
  await page.getByRole("radio", { name: /Negras/ }).check();
  await page.getByTestId("save-analysis").click();
  await expect(page.getByTestId("save-analysis")).toHaveText("Guardado en tu historial");
}

/** Drags a piece on the training board (react-chessboard renders data-square on each square). */
async function drag(page: Page, from: string, to: string) {
  // dnd-kit needs real pointer movement (several steps) to start and track a drag.
  const board = page.getByTestId("train-board");
  const a = await board.locator(`[data-square="${from}"]`).boundingBox();
  const b = await board.locator(`[data-square="${to}"]`).boundingBox();
  if (!a || !b) throw new Error(`square not found: ${from} or ${to}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 5, a.y + a.height / 2 + 5, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  await page.mouse.up();
}

test("mistakes become drills: give up, see the solution, finish for today", async ({ page }) => {
  await registerUser(page, uniqueName("tr"), "clave-de-prueba");

  await page.goto("/entrenar");
  await expect(page.getByTestId("train-empty")).toBeVisible();

  await analyseAndSaveAsBlack(page);
  await page.goto("/entrenar");
  await expect(page.getByTestId("drill")).toBeVisible();
  // Black to move, board seen from Black's side.
  await expect(
    page.getByRole("heading", { name: "Juegan negras. Encuentra la mejor jugada." }),
  ).toBeVisible();

  // Give up on the first drill: it is graded wrong and the solution is shown.
  await page.getByTestId("train-give-up").click();
  await expect(page.getByTestId("train-result")).toHaveAttribute("data-verdict", "wrong");
  const solution = (await page.getByTestId("train-solution").textContent()) ?? "";
  expect(solution).toMatch(/\d+…/);
  await page.getByTestId("train-next").click();

  // Every due drill was shown once: done for today.
  const result = page.getByTestId("train-result");
  while (await page.getByTestId("drill").isVisible()) {
    await page.getByTestId("train-give-up").click();
    await expect(result).toBeVisible();
    await page.getByTestId("train-next").click();
  }
  await expect(page.getByTestId("train-done")).toContainText("¡Al día!");
});

test("the engine move is accepted by dragging it on the board", async ({ page }) => {
  await registerUser(page, uniqueName("tr"), "clave-de-prueba");
  await analyseAndSaveAsBlack(page);
  await page.goto("/entrenar");
  await expect(page.getByTestId("drill")).toBeVisible();

  // Reveal nothing: read the stored best move from the API and play it.
  const { drills } = (await (await page.request.get("/api/drills")).json()) as {
    drills: { bestUci: string }[];
  };
  const best = drills[0]!.bestUci;
  await drag(page, best.slice(0, 2), best.slice(2, 4));
  await expect(page.getByTestId("train-result")).toHaveAttribute("data-verdict", "best");
  await expect(page.getByText("¡Correcto!")).toBeVisible();
});

test("statistics use the saved games where the user played", async ({ page }) => {
  await registerUser(page, uniqueName("st"), "clave-de-prueba");
  await page.goto("/estadisticas");
  await expect(page.getByTestId("stats-empty")).toBeVisible();
  await analyseAndSaveAsBlack(page);
  await page.goto("/estadisticas");
  await expect(page.getByTestId("stats")).toContainText("1 partida ·");
  await expect(page.getByTestId("phase-opening")).toContainText("%");
  await expect(page.getByTestId("openings-table")).toBeVisible();
  await expect(page.getByText("Permitir un mate")).toBeVisible();
});

test("keyboard path: the board is accessible and the move can be typed in Spanish", async ({
  page,
}) => {
  await registerUser(page, uniqueName("kb"), "clave-de-prueba");
  await analyseAndSaveAsBlack(page);
  await page.goto("/entrenar");
  await expect(page.getByTestId("drill")).toBeVisible();

  // Pieces have accessible names and the page has no serious axe violations.
  await expect(page.getByRole("button", { name: /^Rey negro en / })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => v.id)).toEqual([]);

  // An illegal move is rejected; the engine's move typed in Spanish SAN is accepted.
  await page.getByTestId("train-input").fill("Rxa1");
  await page.getByRole("button", { name: "Comprobar" }).click();
  await expect(page.getByText("Esa jugada no es legal en esta posición.")).toBeVisible();
  const { drills } = (await (await page.request.get("/api/drills")).json()) as {
    drills: { fen: string; bestUci: string }[];
  };
  const d = drills[0]!;
  const san = new Chess(d.fen).move({
    from: d.bestUci.slice(0, 2),
    to: d.bestUci.slice(2, 4),
    promotion: d.bestUci[4],
  }).san;
  await page.getByTestId("train-input").fill(toSpanishSan(san));
  await page.getByRole("button", { name: "Comprobar" }).click();
  await expect(page.getByTestId("train-result")).toHaveAttribute("data-verdict", "best");
});
