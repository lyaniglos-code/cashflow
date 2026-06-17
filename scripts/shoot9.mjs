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
await page.setViewport({ width: 1100, height: 850, deviceScaleFactor: 1.5 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('quiet hours start'), { timeout: 12000 });
await wait(800);
// fire a test if the section exists
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Weekly pulse')?.click());
await wait(1500);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((n) => n.children.length === 0 && n.textContent.trim() === 'Quiet hours start');
  el?.scrollIntoView({ block: 'start' });
});
await wait(500);
await page.screenshot({ path: join(outDir, '16-settings-sms-bottom.png') });
console.log('shot 16-settings-sms-bottom');
await browser.close();
