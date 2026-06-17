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
await page.setViewport({ width: 1100, height: 820, deviceScaleFactor: 2 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await wait(800);
// Crop the logo + heading area (top center)
await page.screenshot({ path: join(outDir, '11-logo-login.png'), clip: { x: 360, y: 70, width: 380, height: 230 } });
console.log('shot 11-logo-login');

// Sidebar logo on the dashboard
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });
await wait(800);
await page.screenshot({ path: join(outDir, '12-logo-sidebar.png'), clip: { x: 0, y: 0, width: 260, height: 90 } });
console.log('shot 12-logo-sidebar');

await browser.close();
