import type { Page } from "@playwright/test";

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
