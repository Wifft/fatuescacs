import { expect, type Page } from "@playwright/test";

/** Aborts every request that leaves localhost: no e2e test may use the real network. */
export async function blockExternalNetwork(page: Page) {
  await page
    .context()
    .route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) =>
      route.abort("blockedbyclient"),
    );
}

export const uniqueName = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

/** Registers a new account through the UI and returns its recovery code. */
export async function registerUser(page: Page, user: string, password: string): Promise<string> {
  await page.goto("/cuenta");
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByTestId("account-username").fill(user);
  await page.getByTestId("account-password").fill(password);
  await page.getByTestId("account-submit").click();
  const code = page.getByTestId("recovery-code");
  await expect(code).toHaveText(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
  const text = (await code.textContent()) ?? "";
  await page.getByTestId("code-saved").click();
  await expect(page.getByTestId("logged-in")).toContainText(user);
  return text;
}
