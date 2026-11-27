import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { blockExternalNetwork } from "./helpers";

const LEGAL = `[White "Legall"]
[Black "Saint Brie"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const summary = serious.map(
    (v) =>
      `${name}: ${v.id} (${v.impact}) — ${v.help}\n  ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join("\n  ")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

for (const [name, path] of [
  ["inicio", "/"],
  ["importar", "/import"],
  ["cuenta", "/cuenta"],
  ["historial", "/historial"],
  ["entrenar", "/entrenar"],
  ["estadisticas", "/estadisticas"],
  ["motor", "/dev/engine"],
] as const) {
  test(`axe: ${name}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await audit(page, name);
  });
}

test("axe: análisis completo", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("pgn-input").fill(LEGAL);
  await page.getByLabel("Profundidad").selectOption("12");
  await page.getByTestId("analyze").click();
  await expect(page.getByTestId("progress-text")).toHaveAttribute("data-phase", "done", {
    timeout: 60_000,
  });
  await page.getByTestId("move-10").click();
  await audit(page, "análisis");
});
