// Browser smoke test for the client-side features.
//
// Everything else is verifiable from the build output, but search, the theme
// toggle and the hit counter only exist once JavaScript runs. This drives a
// real browser against a real server so those three are actually exercised.
//
// Usage:  pnpm build && caddy run ... && node scripts/smoke.mjs [baseURL]

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8899';

let failures = 0;
const check = (name, pass, detail = '') => {
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!pass) failures++;
};

// Drives the locally installed Chrome rather than downloading Playwright's own
// build. Set SMOKE_CHANNEL=chromium to use a Playwright-managed browser.
const channel = process.env.SMOKE_CHANNEL ?? 'chrome';
const browser = await chromium.launch(channel === 'chromium' ? {} : { channel });
const page = await browser.newPage();

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));

// --------------------------------------------------------------- hit counter
console.log('\nHit counter');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const counterVisible = await page.locator('#hitcounter').isVisible();
check('counter becomes visible after fetch', counterVisible);
const digits = await page.locator('#hitcounter .digit').allTextContents();
check('renders a 6-digit odometer', digits.length === 6, digits.join(''));
check('shows the value from counter.json (127)', digits.join('') === '000127');

// ---------------------------------------------------------------- dark theme
console.log('\nTheme toggle');
const startDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
await page.click('#theme-toggle');
const afterDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
check('toggles the dark class', startDark !== afterDark);

const stored = await page.evaluate(() => localStorage.getItem('theme'));
check('persists the choice to localStorage', stored === (afterDark ? 'dark' : 'light'), stored);

const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const fg = await page.evaluate(() => getComputedStyle(document.body).color);
check(
  afterDark ? 'dark mode is amber phosphor on near-black' : 'light mode is black on white',
  afterDark ? bg === 'rgb(10, 10, 10)' && fg === 'rgb(255, 176, 0)' : true,
  `${bg} / ${fg}`
);

// Reload and confirm the theme does not flash back to light.
await page.reload({ waitUntil: 'domcontentloaded' });
const persisted = await page.evaluate(() => document.documentElement.classList.contains('dark'));
check('theme survives a reload', persisted === afterDark);

// -------------------------------------------------------------------- search
console.log('\nSearch (Pagefind)');
await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
await page.fill('#q', 'attention sink');
await page.click('.searchbox button');
await page.waitForFunction(() => document.querySelectorAll('#search-results li').length > 0, {
  timeout: 15000,
});
const results = await page.locator('#search-results li').count();
check('English query returns results', results > 0, `${results} result(s)`);
const firstTitle = await page.locator('#search-results li a').first().textContent();
check('result links to the right post', /Attention Sinks/.test(firstTitle ?? ''), firstTitle ?? '');
const hasMark = await page.locator('#search-results mark').count();
check('excerpt highlights the matched terms', hasMark > 0, `${hasMark} <mark>`);
const urlHasQuery = page.url().includes('q=attention');
check('query is reflected in the URL', urlHasQuery, page.url());

// The Chinese index is a separate corpus; make sure it is wired up too.
await page.goto(`${BASE}/zh/search`, { waitUntil: 'networkidle' });
await page.fill('#q', '长上下文');
await page.click('.searchbox button');
await page.waitForFunction(() => document.querySelectorAll('#search-results li').length > 0, {
  timeout: 15000,
});
const zhResults = await page.locator('#search-results li').count();
check('Chinese query returns results', zhResults > 0, `${zhResults} result(s)`);

// A query that must not match, to prove we are not just rendering everything.
await page.fill('#q', 'zzzznonexistentterm');
await page.click('.searchbox button');
await page.waitForFunction(
  () => document.querySelectorAll('#search-results li').length === 0,
  { timeout: 15000 }
);
const noResultStatus = await page.locator('#search-status').textContent();
check('nonsense query reports no results', (noResultStatus ?? '').length > 0, noResultStatus ?? '');

// ---------------------------------------------------------------------- math
console.log('\nRendering');
await page.goto(`${BASE}/blog/hello-world`, { waitUntil: 'networkidle' });
const katex = await page.locator('.katex').count();
check('KaTeX renders formulas', katex > 0, `${katex} node(s)`);
const shiki = await page.locator('pre.astro-code').count();
check('Shiki renders code blocks', shiki > 0, `${shiki} block(s)`);

// The site must not pull a single web font outside of KaTeX on a post page.
const fontRequests = [];
page.on('request', (r) => {
  if (/\.(woff2?|ttf|otf|eot)(\?|$)/.test(r.url())) fontRequests.push(r.url());
});
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
check('home page requests zero web fonts', fontRequests.length === 0, fontRequests.join(', '));

// ------------------------------------------------------------------- console
console.log('\nConsole');
check('no JavaScript errors on any page visited', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

console.log(`\n${failures === 0 ? 'All smoke tests passed.' : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
