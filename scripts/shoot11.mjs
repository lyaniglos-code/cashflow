import puppeteer from 'puppeteer-core';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'shots');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE-EXCEPTION:', e.message));
await page.setViewport({ width: 1366, height: 900 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });
await wait(1500);
// scroll to bottom to trigger all reveals, then back to top
await page.evaluate(async () => {
  const main = document.querySelector('main');
  if (!main) return;
  for (let y = 0; y <= main.scrollHeight; y += 400) {
    main.scrollTo({ top: y });
    await new Promise((r) => setTimeout(r, 60));
  }
  main.scrollTo({ top: 0 });
});
await wait(1200);
await page.screenshot({ path: join(outDir, '19-dashboard-final.png'), fullPage: true });
console.log('shot 19-dashboard-final');
await browser.close();
