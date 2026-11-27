// Renders public/icon.svg to the PNG icons the manifest needs (run by hand, output committed).
//   node scripts/build-icons.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pub = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const svg = readFileSync(join(pub, "icon.svg"), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();

for (const { name, size, maskable } of [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  // Maskable: full-bleed background, artwork inside the 80% safe zone.
  { name: "icon-maskable-512.png", size: 512, maskable: true },
]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable ? size * 0.8 : size;
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${maskable ? "#ad7b4e" : "transparent"}">
      <div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div>
    </body></html>`,
  );
  await page.screenshot({ path: join(pub, name), omitBackground: !maskable });
  console.log(name);
}
await browser.close();
