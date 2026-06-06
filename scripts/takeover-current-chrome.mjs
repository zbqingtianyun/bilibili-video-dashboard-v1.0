import { chromium } from "playwright";

const cdpEndpoint = process.env.CHROME_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const targetUrlKeyword = process.env.TARGET_URL_KEYWORD?.trim();

function isAutomationPage(page) {
  const url = page.url();
  return (
    url &&
    !url.startsWith("chrome://") &&
    !url.startsWith("chrome-extension://") &&
    !url.startsWith("devtools://")
  );
}

function selectExistingPage(pages) {
  const candidates = pages.filter(isAutomationPage);

  if (targetUrlKeyword) {
    const matchedPage = candidates.find((page) => page.url().includes(targetUrlKeyword));
    if (matchedPage) {
      return matchedPage;
    }
  }

  return candidates.at(-1) ?? pages.at(-1);
}

async function main() {
  const browser = await chromium.connectOverCDP(cdpEndpoint);
  const contexts = browser.contexts();
  const pages = contexts.flatMap((context) => context.pages());
  const page = selectExistingPage(pages);

  if (!page) {
    throw new Error("未发现可接管的 Chrome 已打开页面；脚本不会新建页面。");
  }

  await page.bringToFront();
  await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});

  console.log(`已接管当前 Chrome 页面：${await page.title()}`);
  console.log(page.url());

  await browser.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
