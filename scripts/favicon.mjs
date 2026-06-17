import puppeteer from 'puppeteer-core';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Extract the favicon data URI from index.html
const html = readFileSync(join(__dirname, '..', 'client', 'index.html'), 'utf8');
const m = html.match(/rel="icon" href="([^"]+)"/);
const uri = m[1];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 520, height: 220, deviceScaleFactor: 3 });
await page.setContent(`
  <div style="display:flex;gap:24px;align-items:center;padding:24px;font-family:sans-serif">
    <div style="display:flex;gap:18px;align-items:center;background:#1b1d22;padding:16px 22px;border-radius:12px">
      <img src="${uri}" width="16" height="16"/>
      <img src="${uri}" width="32" height="32"/>
      <img src="${uri}" width="48" height="48"/>
    </div>
    <div style="display:flex;gap:18px;align-items:center;background:#e8e8ea;padding:16px 22px;border-radius:12px">
      <img src="${uri}" width="16" height="16"/>
      <img src="${uri}" width="32" height="32"/>
      <img src="${uri}" width="48" height="48"/>
    </div>
  </div>`);
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: join(__dirname, '..', 'shots', '20-favicon.png') });
console.log('shot 20-favicon');
await browser.close();
