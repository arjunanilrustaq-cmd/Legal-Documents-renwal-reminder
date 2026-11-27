import { spawn } from "node:child_process";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const PORT = 4177;
const BASE = `http://127.0.0.1:${PORT}/?today=2026-11-27&screenshot=1`;
const OUT = path.resolve("docs/screenshots");
const ART = "/opt/cursor/artifacts";

const scenes: { file: string; scene: string }[] = [
  { file: "home.png", scene: "home" },
  { file: "add-document.png", scene: "add-doc" },
  { file: "document-detail.png", scene: "doc-detail" },
  { file: "expiry-alarm.png", scene: "alarm" },
  { file: "settings.png", scene: "settings" },
  { file: "monthly-tasks.png", scene: "monthly" },
  { file: "add-monthly-task.png", scene: "add-task" },
  { file: "calendar-month.png", scene: "calendar" },
];

function serve(): { stop: () => void } {
  const child = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    stop: () => {
      child.kill("SIGTERM");
    },
  };
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

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  await mkdir(ART, { recursive: true });
  const server = serve();
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean((window as unknown as { __eg?: unknown }).__eg));
  await page.evaluate(async () => {
    const eg = (window as unknown as { __eg: { seedDemo: () => Promise<void> } }).__eg;
    await eg.seedDemo();
  });
  for (const scene of scenes) {
    await page.evaluate(async (name) => {
      const eg = (window as unknown as { __eg: { showScene: (s: string) => Promise<void> } }).__eg;
      await eg.showScene(name);
    }, scene.scene);
    await page.waitForTimeout(250);
    const dest = path.join(OUT, scene.file);
    await page.screenshot({ path: dest, type: "png" });
    await copyFile(dest, path.join(ART, scene.file));
    console.log("wrote", dest);
  }
  await browser.close();
  server.stop();
  process.exit(0);
}

await main();
