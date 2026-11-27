import { spawn } from "node:child_process";
import { chromium, type Page } from "playwright";

const PORT = 4178;

function serve(): { stop: () => void } {
  const child = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { stop: () => child.kill("SIGTERM") };
}

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("preview server did not start");
}

async function expectText(page: Page, text: string): Promise<void> {
  const loc = page.getByText(text, { exact: false }).first();
  await loc.waitFor({ timeout: 5000 });
}

async function main(): Promise<void> {
  const server = serve();
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${PORT}/?today=2026-11-27`, { waitUntil: "networkidle" });

  await expectText(page, "Coming up");
  await expectText(page, "Nothing coming up");

  await page.click(".fab");
  await expectText(page, "Monthly task");
  await page.click(".choice:has-text('Document')");
  await expectText(page, "Add document");

  await page.locator("[data-act=save-doc]").click();
  await expectText(page, "Name needed");
  await page.locator("[data-act=confirm-yes]").click();

  await page.fill("[data-act=doc-name]", "Test commercial");
  await page.fill("[data-act=doc-expiry]", "2026-12-05");
  await page.locator("[data-act=save-doc]").click();
  await expectText(page, "Test commercial");

  await page.click("text=Test commercial");
  await expectText(page, "Renewed: set new date");
  await page.locator("[data-act=delete-doc]").click();
  await expectText(page, "Delete this document?");
  await page.locator("[data-act=confirm-yes]").click();
  await expectText(page, "Nothing coming up");

  await page.click("text=Calendar");
  await expectText(page, "Calendar");
  await page.click("text=List");
  await expectText(page, "Nothing in the next 90 days");

  await page.click("text=Monthly");
  await expectText(page, "No monthly tasks");
  await page.click(".fab");
  await expectText(page, "Add monthly task");
  await page.fill("[data-act=task-name]", "Staff salary deposit");
  await page.locator("[data-act=save-task]").click();
  await expectText(page, "Staff salary deposit");
  await page.locator("[data-tab=home]").click();
  await expectText(page, "Coming up");
  await expectText(page, "Staff salary deposit");
  await page.locator(".item.monthly").first().waitFor();

  await page.locator("[data-tab=settings]").click();
  await expectText(page, "Default reminders");
  await expectText(page, "Backup");
  await expectText(page, "Monthly summary");

  await browser.close();
  server.stop();
  console.log("UI verification passed");
  process.exit(0);
}

await main();
