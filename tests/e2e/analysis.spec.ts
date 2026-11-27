import { expect, test, type Page } from "@playwright/test";

// Short game so the real engine (in the browser, no network) finishes quickly in CI.
const LEGAL = `[White "Legall"]
[Black "Saint Brie"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

async function analyse(page: Page, pgn: string, depth = "12") {
  await page.goto("/");
  await page.getByTestId("pgn-input").fill(pgn);
  await page.getByLabel("Profundidad").selectOption(depth);
  await page.getByTestId("analyze").click();
  await expect(page).toHaveURL(/\/analysis#.+/);
}

test("paste a PGN → full analysis → accuracy appears", async ({ page }) => {
  await analyse(page, LEGAL);
  await expect(page.getByTestId("progress-text")).toHaveAttribute("data-phase", "done", {
    timeout: 60_000,
  });
  await expect(page.getByTestId("accuracy-w-value")).toHaveText(/^\d{1,3},\d$/);
  await expect(page.getByTestId("accuracy-b-value")).toHaveText(/^\d{1,3},\d$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Legall – Saint Brie");
  // 5... Axd1 takes the queen but walks into mate: it must be a blunder.
  await expect(page.getByTestId("move-10")).toHaveAttribute("data-class", "blunder");
  await page.getByTestId("move-10").click();
  await expect(page.getByTestId("explanation")).toContainText("Permite mate en 2: 6. Axf7+");
  // Mate is the best move, shown in Spanish notation.
  await expect(page.getByTestId("move-13")).toHaveAttribute("data-class", "best");
  await expect(page.getByTestId("move-13")).toContainText("Cd5#");
});

test("keyboard navigation", async ({ page }) => {
  await analyse(page, LEGAL);
  const board = page.getByTestId("board");
  const panel = page.getByTestId("current-move");
  await expect(panel.getByRole("heading")).toHaveText("Posición inicial");

  await page.keyboard.press("ArrowRight");
  await expect(panel.getByRole("heading")).toHaveText("1. e4");
  await page.keyboard.press("ArrowRight");
  await expect(panel.getByRole("heading")).toHaveText("1… e5");
  await page.keyboard.press("ArrowLeft");
  await expect(panel.getByRole("heading")).toHaveText("1. e4");
  await page.keyboard.press("End");
  await expect(panel.getByRole("heading")).toHaveText("7. Cd5#");
  await expect(board).toHaveAttribute("data-fen", /^rn1q1bnr\/ppp1kB1p\//);
  await page.keyboard.press("Home");
  await expect(panel.getByRole("heading")).toHaveText("Posición inicial");
  await expect(page.getByTestId("move-1")).not.toHaveAttribute("aria-current", "true");
});

test("an invalid PGN shows an error with the offending move", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("pgn-input").fill("1. e4 e5 2. Nf3 Nc6\n3. Bb5 a6 4. Bxe7 Nf6");
  await page.getByTestId("analyze").click();
  await expect(page.getByTestId("pgn-error")).toContainText("4. «Bxe7»");
  await expect(page.getByTestId("pgn-error")).toContainText("línea 2");
  await expect(page).toHaveURL(/\/$/);
});

test("a broken share link shows an error", async ({ page }) => {
  await page.goto("/analysis#esto-no-es-un-pgn");
  await expect(page.getByTestId("analysis-error")).toBeVisible();
});

test("notation can be switched to English", async ({ page }) => {
  await analyse(page, LEGAL);
  await page.getByLabel("Notación").selectOption("en");
  await expect(page.getByTestId("move-13")).toContainText("Nd5#");
});
