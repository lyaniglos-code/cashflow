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
await page.setViewport({ width: 1100, height: 900 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });
await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.innerText.includes('set up your cash flow'), { timeout: 10000 });
// Continue from profile -> choose
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Continue')?.click());
await page.waitForFunction(() => document.body.innerText.includes('How would you like to add your money data'), { timeout: 10000 });
await wait(600);
await page.screenshot({ path: join(outDir, '10-onboarding-choose.png') });
console.log('shot 10-onboarding-choose');
await browser.close();
