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
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()); });
await page.setViewport({ width: 1366, height: 1000 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });
await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle2' });
try {
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('break-even'), { timeout: 15000 });
} catch (e) {
  const t = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log('ANALYTICS BODY:', JSON.stringify(t));
  throw e;
}
await wait(1800); // let all recharts render
await page.screenshot({ path: join(outDir, '13-analytics.png'), fullPage: true });
console.log('shot 13-analytics');
await browser.close();
