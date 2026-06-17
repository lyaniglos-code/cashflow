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
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });
await wait(2000); // let reveal settle
// Sidebar crop (full height)
await page.screenshot({ path: join(outDir, '17-sidebar.png'), clip: { x: 0, y: 0, width: 256, height: 820 } });
console.log('shot 17-sidebar');
// Navigate to Settings to confirm the animated flow works without errors
await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('break-even'), { timeout: 15000 }).catch(() => {});
await wait(1800);
await page.screenshot({ path: join(outDir, '18-analytics-sidebar.png'), clip: { x: 0, y: 0, width: 256, height: 820 } });
console.log('shot 18-analytics-sidebar');
await browser.close();
