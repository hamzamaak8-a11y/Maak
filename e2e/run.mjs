// End-to-end UI regression test against an in-memory mock of Supabase and the Worker.
//   npm run test:e2e
// It builds the web bundle with mock endpoints (dotenv disabled), serves it, and drives a real Chromium.
// Needs Chromium: set CHROMIUM_PATH, or have PLAYWRIGHT_BROWSERS_PATH point at a Playwright browsers folder.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeBackend } from './mock.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'maak-e2e-'));
const shots = process.env.E2E_SHOTS_DIR;

function chromePath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).filter(n => n.startsWith('chromium')).sort().reverse()) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const f = path.join(base, d, rel);
        if (fs.existsSync(f)) return f;
      }
    }
  }
  return undefined;
}

const outAdmin = fs.mkdtempSync(path.join(os.tmpdir(), 'maak-e2e-admin-'));
function build(dir, target) {
  console.log(`Building the ${target} web bundle with mock endpoints…`);
  execFileSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', dir], {
    cwd: root, stdio: 'ignore',
    env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_OFFLINE: '1', CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_PUBLIC_APP_TARGET: target, EXPO_PUBLIC_SUPABASE_URL: 'https://sb.test', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key', EXPO_PUBLIC_API_URL: 'https://workers.test', EXPO_PUBLIC_WEB_URL: 'http://localhost:4173' },
  });
}
build(out, 'app');
build(outAdmin, 'admin');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.json': 'application/json' };
const serve = (dir, port) => http.createServer((req, res) => {
  let f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(port);
const server = serve(out, 4173);
const adminServer = serve(outAdmin, 4174);

const be = makeBackend();
const browser = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] });
const problems = [];
const passed = [];
let n = 0;

async function newPage(locale = 'en-US', size = { width: 420, height: 860 }) {
  const ctx = await browser.newContext({ viewport: size, locale });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/WebSocket|status of 400/.test(m.text())) problems.push('console.error: ' + m.text().slice(0, 300)); });
  page.on('pageerror', e => problems.push('PAGEERROR: ' + e.message.slice(0, 400)));
  await page.route('https://workers.test/**', be.handleWorker);
  await page.route('https://sb.test/**', be.handleSupabase);
  return page;
}
const shot = async (page, name) => { if (!shots) return; fs.mkdirSync(shots, { recursive: true }); await page.waitForTimeout(400); await page.screenshot({ path: path.join(shots, `${String(++n).padStart(2, '0')}-${name}.png`) }); };
const must = async (page, text, t = 15000) => { try { await page.waitForSelector(`text=${text} >> visible=true`, { timeout: t }); } catch { await shot(page, 'FAIL'); throw new Error(`missing text "${text}". Page shows: ${(await page.innerText('body')).slice(0, 400)}`); } };
const ok = name => { passed.push(name); console.log('  ✓', name); };

async function login(page, email, password = 'password123') {
  await vis(page, 'Sign in', true).click();
  await must(page, 'Welcome back');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).last().click();
}
// Navigators keep earlier screens mounted (hidden), so always act on the VISIBLE match.
const vis = (page, text, exact = false) => page.locator(`${exact ? `text="${text}"` : `text=${text}`} >> visible=true`).first();
async function adminLogin(page, email, password = 'password123') {
  await page.goto('http://localhost:4174/');
  await must(page, 'Administration panel');
  await page.getByPlaceholder('name@example.com').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).last().click();
}
const open = async page => { await page.goto('http://localhost:4173/'); await must(page, 'Browse services'); };

try {
  // legal pages are shipped with the web build
  for (const [file, text] of [['privacy.html', 'Privacy policy'], ['terms.html', 'Terms of use'], ['delete-account.html', 'Delete your MAAK account']]) {
    const res = await fetch(`http://localhost:4173/${file}`);
    const body = await res.text();
    if (!res.ok || !body.includes(text) || !body.includes('hamzamaak8@gmail.com')) throw new Error(`legal page ${file} is missing or incomplete`);
  }
  ok('legal pages (privacy, terms, delete-account) are published');

  let page = await newPage();
  await open(page);
  await must(page, 'Terms of use'); await must(page, 'Privacy policy');
  await shot(page, 'welcome');
  ok('welcome screen shows legal links');
  await vis(page, 'Browse services').click();
  await must(page, 'Top rated');
  await vis(page, 'Bookings', true).click();
  await must(page, 'Sign in to continue');
  ok('guest can browse; bookings require sign-in');
  await page.context().close();

  // customer: book, report, delete-blocked
  page = await newPage();
  await open(page);
  await login(page, 'customer@t.co');
  await must(page, 'Top rated');
  await page.waitForTimeout(800); await shot(page, 'home');
  await vis(page, 'Karim Benali').click();
  await must(page, 'Book now');
  await vis(page, 'Book now').click();
  await must(page, 'Book a service');
  await vis(page, 'Next', true).click();
  await page.getByText(/^[A-Z][a-z]{2}, \d+ [A-Z][a-z]{2}$/).nth(1).click(); // tomorrow: today may have no future slots
  await page.waitForSelector('text=09:00', { timeout: 15000 });
  await vis(page, '09:00', true).click();
  await vis(page, 'Next', true).click();
  await page.getByPlaceholder('Neighbourhood, street, city').fill('12 rue des Fleurs, Casablanca');
  await vis(page, 'Next', true).click();
  await vis(page, 'Send request', true).click();
  await must(page, 'Request sent');
  ok('customer books a provider');
  await vis(page, 'Home', true).click();
  await must(page, 'Top rated');
  await vis(page, 'Karim Benali').click();
  await must(page, 'Book now');
  await shot(page, 'provider-top');
  await page.mouse.move(200, 500); await page.mouse.wheel(0, 650); await shot(page, 'provider-scrolled');
  await page.locator('[aria-label="Report"] >> visible=true').first().click();
  await must(page, 'Why', 1500).catch(() => {});
  await vis(page, 'Spam', true).click();
  await shot(page, 'report-sheet');
  await vis(page, 'Send report', true).click();
  await must(page, 'Thank you. Our team will review this report.');
  if (be.state.reports.length !== 1) throw new Error('report was not sent');
  ok('customer reports a provider');
  await page.context().close();

  // account deletion: blocked while a booking is open
  page = await newPage();
  await open(page);
  await login(page, 'customer@t.co');
  await must(page, 'Top rated');
  await vis(page, 'Profile', true).click();
  await vis(page, 'Security', true).click();
  await vis(page, 'Delete my account', true).click();
  await must(page, 'This permanently deletes your account');
  await shot(page, 'delete-account');
  const del = () => vis(page, 'Delete my account permanently', true);
  await page.getByPlaceholder('customer@t.co').fill('wrong@t.co');
  await del().click({ force: true }).catch(() => {});
  if (be.state.deleted.length) throw new Error('deleted without confirmation');
  await page.getByPlaceholder('customer@t.co').fill('customer@t.co');
  await del().click();
  await must(page, 'Finish or cancel your open bookings before deleting your account.');
  ok('account deletion is blocked while a booking is open');
  await page.context().close();

  // account deletion: allowed for an account with no open bookings
  page = await newPage();
  await open(page);
  await login(page, 'spare@t.co');
  await must(page, 'Top rated');
  await vis(page, 'Profile', true).click();
  await vis(page, 'Security', true).click();
  await vis(page, 'Delete my account', true).click();
  await page.getByPlaceholder('spare@t.co').fill('SPARE@t.co');
  await vis(page, 'Delete my account permanently', true).click();
  await must(page, 'Browse services');
  if (be.state.deleted.length !== 1) throw new Error('account was not deleted');
  ok('account deletion works and returns to the welcome screen');
  await page.context().close();

  // admin portal (separate build / address): moderation queue
  page = await newPage();
  await adminLogin(page, 'admin@t.co');
  await must(page, 'Provider applications');
  await shot(page, 'admin-home');
  await vis(page, 'More', true).click();
  await vis(page, 'Reports', true).click();
  await must(page, 'Reported: Karim Benali');
  await shot(page, 'admin-reports');
  await vis(page, 'Resolve', true).click();
  await page.getByRole('button', { name: 'Resolve' }).last().click();
  await must(page, 'No reports');
  ok('admin portal: sign in, see and resolve reports');
  await page.context().close();

  // admin portal on a desktop-sized screen
  page = await newPage('en-US', { width: 1360, height: 860 });
  await adminLogin(page, 'admin@t.co');
  await must(page, 'Provider applications');
  await page.waitForTimeout(600);
  await shot(page, 'admin-desktop');
  await page.context().close();

  // the admin portal refuses non-admins; the app refuses admins
  page = await newPage();
  await adminLogin(page, 'customer@t.co');
  await must(page, 'This account is not an administrator.');
  ok('admin portal rejects a non-admin account');
  await page.context().close();
  page = await newPage();
  await open(page);
  await login(page, 'admin@t.co');
  await must(page, 'Administrator accounts cannot use the app.');
  await shot(page, 'admin-blocked-in-app');
  ok('the customer app refuses an administrator account');
  await page.context().close();

  // provider accepts
  page = await newPage();
  await open(page);
  await login(page, 'provider@t.co');
  await must(page, 'Completed jobs');
  await vis(page, 'Requests', true).click();
  await must(page, 'New (1)');
  await vis(page, 'Amina Lahrichi', true).click();
  await must(page, 'Booking details');
  await vis(page, 'Accept', true).click();
  await must(page, 'Start service');
  ok('provider accepts a request');
  await page.context().close();

  // wrong password + Arabic RTL
  page = await newPage();
  await open(page);
  await login(page, 'customer@t.co', 'nope');
  await must(page, 'Incorrect email or password.');
  ok('wrong password shows a clear error');
  await page.context().close();
  page = await newPage('ar-MA');
  await page.goto('http://localhost:4173/');
  await must(page, 'تصفّح الخدمات');
  await vis(page, 'تصفّح الخدمات').click();
  await must(page, 'الأعلى تقييمًا');
  ok('Arabic (RTL) renders');
} catch (e) {
  console.error('\nFAILED:', e.message);
  if (process.env.E2E_DEBUG) console.error(be.state.log.slice(-12).join('\n'));
  problems.push('scenario failure');
}

console.log(`\n${passed.length} checks passed`);
if (be.state.log.some(l => l.includes('UNMOCKED'))) { console.log('Unmocked calls:', be.state.log.filter(l => l.includes('UNMOCKED')).join(' | ')); problems.push('unmocked call'); }
if (problems.length) console.log('Problems:\n' + [...new Set(problems)].join('\n'));
await browser.close(); server.close(); adminServer.close(); fs.rmSync(out, { recursive: true, force: true }); fs.rmSync(outAdmin, { recursive: true, force: true });
process.exit(problems.length ? 1 : 0);
