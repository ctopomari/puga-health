import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = "/workspace";
const GROK = join(ROOT, ".grok");
const ART = join(ROOT, "artifacts/imagine_images");
const FONT_DIR = join(GROK, "fonts");

function dataUri(filePath, mime) {
  return `data:${mime};base64,${readFileSync(filePath).toString("base64")}`;
}

const bg = dataUri(join(ART, "3c875f1c-459d-47ef-857d-cf73cdd30dcb.jpg"), "image/jpeg");
const playfair = dataUri(join(FONT_DIR, "PlayfairDisplay[wght].ttf"), "font/ttf");
const outfit = dataUri(join(FONT_DIR, "Outfit[wght].ttf"), "font/ttf");
const cinzel = dataUri(join(FONT_DIR, "Cinzel[wght].ttf"), "font/ttf");
const faviconSvg = readFileSync(join(GROK, "favicon.svg.tmp"), "utf8");

const cssFonts = `
@font-face { font-family: "Playfair"; src: url("${playfair}") format("truetype"); font-weight: 100 900; font-style: normal; }
@font-face { font-family: "Outfit"; src: url("${outfit}") format("truetype"); font-weight: 100 900; font-style: normal; }
@font-face { font-family: "Cinzel"; src: url("${cinzel}") format("truetype"); font-weight: 100 900; font-style: normal; }
`;

function cardHtml(variant) {
  const layouts = {
    stacked: {
      position: "center 36%",
      body: `
        <div class="lockup">
          <div class="title">PugaAI</div>
          <div class="title2">Health</div>
          <div class="rule"></div>
          <div class="tag">Your AI-powered voice health navigator</div>
        </div>`,
    },
    single: {
      position: "center 34%",
      body: `
        <div class="lockup single">
          <div class="title-one">PugaAI Health</div>
          <div class="rule"></div>
          <div class="tag">Your AI-powered voice health navigator</div>
        </div>`,
    },
    cinzel: {
      position: "center 36%",
      body: `
        <div class="lockup cinzel">
          <div class="ctitle">PugaAI</div>
          <div class="ctitle2">Health</div>
          <div class="rule"></div>
          <div class="tag">Your AI-powered voice health navigator</div>
        </div>`,
    },
  };
  const L = layouts[variant];
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  ${cssFonts}
  html, body { margin: 0; padding: 0; width: 1200px; height: 630px; overflow: hidden; }
  .card {
    width: 1200px; height: 630px;
    background-image: url("${bg}");
    background-size: cover;
    background-position: ${L.position};
    background-repeat: no-repeat;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
  }
  .scrim {
    position: absolute; inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(75,18,111,0.00) 38%,
      rgba(30,24,37,0.18) 58%,
      rgba(30,24,37,0.52) 100%
    );
  }
  .lockup {
    position: relative;
    z-index: 2;
    text-align: center;
    padding: 0 180px 58px;
    width: 100%;
    box-sizing: border-box;
  }
  .title {
    font-family: "Playfair", serif;
    font-weight: 700;
    font-size: 78px;
    line-height: 0.92;
    color: #faf8fc;
    letter-spacing: 0.02em;
    text-shadow: 0 10px 28px rgba(30,24,37,0.55);
  }
  .title2 {
    font-family: "Playfair", serif;
    font-weight: 600;
    font-size: 64px;
    line-height: 1.02;
    color: #faf8fc;
    letter-spacing: 0.18em;
    text-transform: none;
    margin-top: 4px;
    text-shadow: 0 10px 28px rgba(30,24,37,0.55);
  }
  .title-one {
    font-family: "Playfair", serif;
    font-weight: 700;
    font-size: 64px;
    line-height: 1;
    color: #faf8fc;
    letter-spacing: 0.04em;
    text-shadow: 0 10px 28px rgba(30,24,37,0.55);
  }
  .ctitle {
    font-family: "Cinzel", serif;
    font-weight: 650;
    font-size: 68px;
    line-height: 0.95;
    color: #faf8fc;
    letter-spacing: 0.12em;
    text-shadow: 0 10px 28px rgba(30,24,37,0.55);
  }
  .ctitle2 {
    font-family: "Cinzel", serif;
    font-weight: 600;
    font-size: 42px;
    line-height: 1.1;
    color: #faf8fc;
    letter-spacing: 0.42em;
    text-transform: uppercase;
    margin-top: 6px;
    text-shadow: 0 10px 28px rgba(30,24,37,0.55);
  }
  .rule {
    width: 88px;
    height: 2px;
    background: #d9a52d;
    margin: 16px auto 14px;
    border-radius: 2px;
    box-shadow: 0 0 12px rgba(217,165,45,0.45);
  }
  .tag {
    font-family: "Outfit", sans-serif;
    font-weight: 400;
    font-size: 20px;
    letter-spacing: 0.08em;
    color: #d9a52d;
    text-shadow: 0 6px 18px rgba(30,24,37,0.6);
  }
</style>
</head>
<body>
  <div class="card">
    <div class="scrim"></div>
    ${L.body}
  </div>
</body>
</html>`;
}

function iconHtml(size) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; overflow: hidden; background: #4b126f; }
  svg { width: ${size}px; height: ${size}px; display: block; }
</style>
</head>
<body>${faviconSvg}</body>
</html>`;
}

async function shot(page, html, width, height, outPath, scale = 2) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 120)));
  await page.screenshot({
    path: outPath,
    type: "png",
    omitBackground: false,
  });
}

const browser = await chromium.launch({
  args: ["--font-render-hinting=none", "--disable-lcd-text"],
});
const context = await browser.newContext({
  deviceScaleFactor: 2,
  viewport: { width: 1200, height: 630 },
});
const page = await context.newPage();

mkdirSync(join(GROK, "brand-previews"), { recursive: true });

for (const variant of ["stacked", "single", "cinzel"]) {
  await shot(
    page,
    cardHtml(variant),
    1200,
    630,
    join(GROK, "brand-previews", `og-${variant}.png`),
  );
}

await context.close();

const iconCtx = await browser.newContext({
  deviceScaleFactor: 1,
  viewport: { width: 512, height: 512 },
});
const iconPage = await iconCtx.newPage();
await shot(iconPage, iconHtml(512), 512, 512, join(GROK, "brand-previews", "icon-512.png"), 1);
await shot(iconPage, iconHtml(192), 192, 192, join(GROK, "brand-previews", "icon-192.png"), 1);

await browser.close();
console.log("composed");
