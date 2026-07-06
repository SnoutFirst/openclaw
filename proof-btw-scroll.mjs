import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const cssFiles = [
  "ui/src/styles/base.css",
  "ui/src/styles/layout.css",
  "ui/src/styles/layout.mobile.css",
  "ui/src/styles/components.css",
  "ui/src/styles/chat/layout.css",
  "ui/src/styles/chat/text.css",
  "ui/src/styles/chat/grouped.css",
  "ui/src/styles/chat/tool-cards.css",
  "ui/src/styles/chat/sidebar.css",
];

const cwd = process.cwd();
const css = cssFiles.map((file) => readFileSync(resolve(cwd, file), "utf8")).join("\n");

const longBody = Array.from(
  { length: 80 },
  (_, i) =>
    `<p>Line ${i + 1}: this is deliberately long filler text so the BTW side-result body definitely exceeds the viewport and must scroll instead of expanding the whole card.</p>`,
).join("");

const html = `<!doctype html>
<html>
<head><style>${css}</style></head>
<body>
  <section class="chat-side-result" role="status" aria-live="polite" aria-label="BTW side result">
    <div class="chat-side-result__header">
      <div class="chat-side-result__label-row">
        <span class="chat-side-result__label">BTW</span>
        <span class="chat-side-result__meta">Not saved to chat history</span>
      </div>
      <button class="btn chat-side-result__dismiss" type="button">X</button>
    </div>
    <div class="chat-side-result__question">What is the full answer?</div>
    <div class="chat-side-result__body" dir="ltr">${longBody}</div>
  </section>
</body>
</html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.setContent(html);

const body = await page.locator(".chat-side-result__body").evaluate((node) => {
  const el = node;
  const style = getComputedStyle(el);
  return {
    overflow: style.overflow,
    overflowY: style.overflowY,
    maxHeight: style.maxHeight,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    scrollable: el.scrollHeight > el.clientHeight,
  };
});

console.log("BTW side-result body metrics:");
console.log(JSON.stringify(body, null, 2));

// Scroll to the bottom and screenshot to prove scrolling works.
await page.locator(".chat-side-result__body").evaluate((node) => {
  node.scrollTo(0, node.scrollHeight);
});

const screenshotPath = resolve(cwd, "proof-btw-scroll.png");
await page.screenshot({ path: screenshotPath, fullPage: true });
console.log("Screenshot saved to:", screenshotPath);

if (!body.scrollable) {
  console.error("FAIL: side-result body is not scrollable");
  process.exitCode = 1;
}

await browser.close();
