import puppeteer from 'puppeteer-core';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'shots');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (page, txt) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim().toLowerCase() === t.toLowerCase());
    if (b) b.click();
    return !!b;
  }, txt);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE-EXCEPTION:', e.message));
await page.setViewport({ width: 1100, height: 1000, deviceScaleFactor: 1.5 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.innerText.includes('SMS Alerts'), { timeout: 10000 });
await wait(800);

// If not already verified, run the verification flow.
const verified = await page.evaluate(() => document.body.innerText.includes('Verified for alerts'));
if (!verified) {
  await page.type('input[placeholder="+1 555 123 4567"]', '+15551234567');
  await clickByText(page, 'Send code');
  await page.waitForFunction(() => document.body.innerText.includes('Simulation code:'), { timeout: 8000 });
  const code = await page.evaluate(() => (document.body.innerText.match(/Simulation code:\s*(\d{6})/) || [])[1]);
  await page.type('input[placeholder="000000"]', code || '');
  await clickByText(page, 'Verify');
  await page.waitForFunction(() => document.body.innerText.includes('Verified for alerts'), { timeout: 8000 });
}
// fire a shortfall test so the message preview shows
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Shortfall');
  if (b) b.click();
});
await wait(1500);
await page.screenshot({ path: join(outDir, '15-settings-sms.png'), fullPage: true });
console.log('shot 15-settings-sms');
await browser.close();
