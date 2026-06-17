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
await page.setViewport({ width: 1440, height: 1000 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('planning assistant'), { timeout: 20000 });
await wait(1200);
// Scroll the Planning Assistant into view and shoot the viewport.
await page.evaluate(() => {
  const el = [...document.querySelectorAll('h3')].find((h) => /planning assistant/i.test(h.textContent));
  el?.scrollIntoView({ block: 'start' });
});
await wait(800);
await page.screenshot({ path: join(outDir, '07-chat-plans.png') });
console.log('shot 07-chat-plans');
await browser.close();
