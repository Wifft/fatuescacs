import { expect, test, type Page } from "@playwright/test";
import { blockExternalNetwork, registerUser, uniqueName } from "./helpers";

const LEGAL = `[White "Legall"]
[Black "Saint Brie"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`;

test.beforeEach(async ({ page }) => {
  await blockExternalNetwork(page);
});

async function analyseLegal(page: Page) {
  await page.goto("/");
  await page.getByTestId("pgn-input").fill(LEGAL);
  await page.getByLabel("Profundidad").selectOption("12");
  await page.getByTestId("analyze").click();
}

test("register → analyse → save → history → reopen → delete", async ({ page }) => {
  await registerUser(page, uniqueName("e2e"), "clave-de-prueba");

  await analyseLegal(page);
  await expect(page.getByTestId("progress-text")).toHaveAttribute("data-phase", "done", {
    timeout: 60_000,
  });
  await expect(page.getByTestId("save-analysis")).toBeDisabled(); // colour not chosen yet
  await page.getByRole("radio", { name: /Blancas/ }).check();
  await page.getByTestId("save-analysis").click();
  await expect(page.getByTestId("save-analysis")).toHaveText("Guardado en tu historial");

  await page.goto("/historial");
  const items = page.getByTestId("history-item");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Legall – Saint Brie");
  await items.first().getByRole("button", { name: "Abrir" }).click();
  await expect(page).toHaveURL(/\/analysis#.+/);
  // The saved evaluations are reused: no new engine search is needed.
  await expect(page.getByTestId("progress-text")).toHaveAttribute("data-phase", "done", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("accuracy-w-value")).toHaveText(/^\d{1,3},\d$/);

  // Delete it: two clicks, no browser dialog.
  await page.goto("/historial");
  await page.getByTestId("history-item").first().getByRole("button", { name: "Borrar" }).click();
  await page.getByRole("button", { name: /Pulsa otra vez/ }).click();
  await expect(page.getByText("Todavía no has guardado ningún análisis.")).toBeVisible();
});

test("login errors, logout and recovery with the code", async ({ page }) => {
  const user = uniqueName("rec");
  const code = await registerUser(page, user, "primera-clave");
  await page.getByRole("button", { name: "Salir" }).click();

  await page.getByTestId("account-username").fill(user);
  await page.getByTestId("account-password").fill("no-es-esta");
  await page.getByTestId("account-submit").click();
  await expect(page.getByTestId("account-error")).toHaveText("Usuario o contraseña incorrectos.");

  await page.getByRole("tab", { name: "Recuperar acceso" }).click();
  await page.getByTestId("account-username").fill(user);
  await page.getByTestId("account-code").fill(code.toLowerCase());
  await page.getByTestId("account-password").fill("segunda-clave");
  await page.getByTestId("account-submit").click();
  const newCode = page.getByTestId("recovery-code");
  await expect(newCode).toBeVisible();
  await expect(newCode).not.toHaveText(code);
  await page.getByTestId("code-saved").click();
  await expect(page.getByTestId("logged-in")).toContainText(user);
});

test("without an account: history asks to log in, analysis still works", async ({ page }) => {
  await page.goto("/historial");
  await expect(page.getByText("Entra en tu cuenta para ver tu historial.")).toBeVisible();
  await analyseLegal(page);
  await expect(page.getByText("Entra para guardar este análisis")).toBeVisible();
  await expect(page.getByTestId("progress-text")).toHaveAttribute("data-phase", "done", {
    timeout: 60_000,
  });
});
