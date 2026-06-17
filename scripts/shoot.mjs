import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'shots');
mkdirSync(outDir, { recursive: true });

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name, { full = true } = {}) {
  await wait(900);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: full });
  console.log('shot:', name);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()); });
  page.on('pageerror', (e) => console.log('PAGE-EXCEPTION:', e.message));

  // Login page
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await shoot(page, '01-login', { full: false });

  // Sign in (creds pre-filled), wait for dashboard
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent));
    if (btn) btn.click();
  });
  try {
    await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });
  } catch (e) {
    await page.screenshot({ path: join(outDir, 'debug-postlogin.png'), fullPage: true });
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 600));
    console.log('POST-LOGIN BODY:', JSON.stringify(txt));
    throw e;
  }
  await wait(1500); // let charts + AI panels render
  await shoot(page, '02-dashboard');

  // Scenario planner
  await page.goto(`${BASE}/scenarios`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.innerText.includes('Baseline'), { timeout: 15000 }).catch(() => {});
  await shoot(page, '03-scenarios');

  // Weekly digest
  await page.goto(`${BASE}/digest`, { waitUntil: 'networkidle2' });
  await wait(1200);
  await shoot(page, '04-digest');

  // Onboarding wizard
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.innerText.includes('set up your cash flow'), { timeout: 10000 }).catch(() => {});
  await shoot(page, '05-onboarding', { full: false });

  // Mobile dashboard
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 15000 }).catch(() => {});
  await wait(1500);
  await shoot(page, '06-mobile-dashboard');

  console.log('DONE');
} catch (err) {
  console.error('SHOOT ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
