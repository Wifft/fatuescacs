import { expect, test, type Page } from "@playwright/test";

// This spec needs the real service worker (blocked everywhere else).
test.use({ serviceWorkers: "allow" });

const LEGAL = `[White "Legall"]
[Black "Saint Brie"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

async function analyse(page: Page) {
  await page.getByTestId("pgn-input").fill(LEGAL);
  await page.getByLabel("Profundidad").selectOption("12");
  await page.getByTestId("analyze").click();
  await expect(page).toHaveURL(/\/analysis#.+/);
  await expect(page.getByTestId("progress-text")).toHaveAttribute("data-phase", "done", {
    timeout: 60_000,
  });
}

test("the web app manifest is valid", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = (await res.json()) as {
    name: string;
    display: string;
    start_url: string;
    icons: { src: string; purpose?: string }[];
  };
  expect(m.name).toBe("Analizador de partidas");
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/");
  expect(m.icons.some((i) => i.purpose === "maskable")).toBe(true);
  for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-cache");
});

test("after one visit, a game can be analysed offline", async ({ page, context }) => {
  await page.goto("/");
  // Wait until the service worker controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Online: analyse once so the engine and the analysis page get cached.
  await analyse(page);
  await page.goto("/");

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await analyse(page);
  await expect(page.getByTestId("accuracy-w-value")).toHaveText(/^\d{1,3},\d$/);
  await context.setOffline(false);
});
