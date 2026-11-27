import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { blockExternalNetwork } from "./helpers";

const fixture = (f: string) => readFileSync(join(__dirname, "../unit/fixtures", f), "utf8");
const cors = { "Access-Control-Allow-Origin": "*" };

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

test("import from Lichess (mocked API) and open a game", async ({ page }) => {
  // Registered after the blocker, so it takes precedence for these URLs.
  await page.context().route("https://lichess.org/api/games/user/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      headers: cors,
      body: fixture("lichess-games.ndjson"),
    }),
  );
  await page.goto("/import");
  await page.getByTestId("import-username").fill("Zablotsky_Sergei");
  await page.getByTestId("import-submit").click();
  const rows = page.getByTestId("imported-game");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Derrota");
  await expect(rows.first()).toContainText("surrenderPLS");
  await expect(rows.first()).toContainText("Blitz");
  await expect(rows.first()).toContainText("C25");
  await rows.first().getByRole("link", { name: "Analizar" }).click();
  await expect(page).toHaveURL(/\/analysis#.+/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Zablotsky_Sergei – surrenderPLS",
  );
  await expect(page.getByTestId("opening")).toContainText("C25");
});

test("import from Chess.com (mocked API) skips variants", async ({ page }) => {
  await page.context().route("https://api.chess.com/pub/player/**", (route) => {
    const url = route.request().url();
    const body = url.endsWith("/archives")
      ? fixture("chesscom-archives.json")
      : url.endsWith("/2026/11")
        ? fixture("chesscom-2026-11.json")
        : fixture("chesscom-2026-10.json");
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body });
  });
  await page.goto("/import");
  await page.getByRole("radio", { name: "Chess.com" }).check();
  await page.getByTestId("import-username").fill("hikaru");
  await page.getByTestId("import-submit").click();
  await expect(page.getByTestId("imported-game")).toHaveCount(6);
  await expect(page.getByText("6 partidas")).toBeVisible();
});

test("unknown user shows a clear error", async ({ page }) => {
  await page.context().route("https://lichess.org/api/**", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      headers: cors,
      body: '{"error":"Not found"}',
    }),
  );
  await page.goto("/import");
  await page.getByTestId("import-username").fill("nadie_existe");
  await page.getByTestId("import-submit").click();
  await expect(page.getByTestId("import-error")).toHaveText("No existe ese usuario.");
});
