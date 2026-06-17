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
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });
await wait(1200);

// Import page (BankConnection notice + QuickBooks + CSV)
await page.goto(`${BASE}/upload`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('live bank connection'), { timeout: 10000 }).catch(() => {});
await wait(600);
await page.screenshot({ path: join(outDir, '08-import-bank.png') });
console.log('shot 08-import-bank');

// Dashboard bank connection card
await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('live bank connection'), { timeout: 15000 }).catch(() => {});
await page.evaluate(() => [...document.querySelectorAll('h3')].find((h) => /live bank connection/i.test(h.textContent))?.scrollIntoView({ block: 'center' }));
await wait(700);
await page.screenshot({ path: join(outDir, '09-dashboard-bank.png') });
console.log('shot 09-dashboard-bank');

await browser.close();
