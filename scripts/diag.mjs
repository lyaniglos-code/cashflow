import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE-EXCEPTION:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()); });
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /sign in/i.test(b.textContent))?.click());
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('cash position'), { timeout: 20000 });

for (const path of ['/upload', '/settings', '/digest', '/scenarios']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' });
  await wait(1800);
  const info = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('main .card')];
    return {
      cardCount: cards.length,
      opacities: cards.slice(0, 4).map((c) => +getComputedStyle(c).opacity),
      revealedNotIn: cards.filter((c) => c.classList.contains('reveal') && !c.classList.contains('in')).length,
      bodyText: (document.querySelector('main')?.innerText || '(empty)').slice(0, 70),
    };
  });
  console.log(path, JSON.stringify(info));
}
await browser.close();
