import { expect, test } from "@playwright/test";

test("the engine test page receives readyok from Stockfish", async ({ page }) => {
  await page.goto("/dev/engine");
  await expect(page.getByTestId("engine-status")).toHaveText("readyok", { timeout: 30_000 });
  await expect(page.getByTestId("engine-name")).toContainText("Stockfish");
  await expect(page.getByTestId("engine-build")).toContainText("WASM");
});

test("the wasm file is served as application/wasm", async ({ request }) => {
  const res = await request.get("/engine/stockfish-19-lite-single.wasm");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/wasm");
});

test("the home page links to the engine test", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Diagnóstico del motor" }).click();
  await expect(page).toHaveURL(/\/dev\/engine$/);
});
