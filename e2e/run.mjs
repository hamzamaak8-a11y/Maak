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
import { fileURLToPath } from 'node:url';
import { makeBackend } from './mock.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'maak-e2e-'));
const shots = process.env.E2E_SHOTS_DIR;

function chromePath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).filter(n => n.startsWith('chromium')).sort().reverse()) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe', 'chrome-win64/chrome.exe']) {
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
  // On Windows `npx` is `npx.cmd`, which Node only starts through a shell.
  const win = process.platform === 'win32';
  execFileSync(win ? 'npx.cmd' : 'npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', dir], {
    cwd: root, stdio: 'ignore', shell: win,
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
  page.on('console', m => { if (m.type() === 'error' && !/WebSocket|status of 400|status of 503/.test(m.text())) problems.push('console.error: ' + m.text().slice(0, 300)); });
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


// ---- accessibility helpers -------------------------------------------------------------------------------------------------
const accessibleName = el => (el.getAttribute('aria-label') || [...(el.labels ?? [])].map(l => l.textContent).join(' ') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || '').trim();
/** Every visible text field must have a programmatic name and the right autocomplete token. */
async function auditFields(page, where, expected) {
  const fields = await page.$$eval('input:not([type=hidden]), textarea', els => els.filter(e => e.offsetParent !== null).map(e => ({ type: e.type, name: (e.getAttribute('aria-label') || [...(e.labels ?? [])].map(l => l.textContent).join(' ') || e.getAttribute('aria-labelledby') || '').trim(), ac: e.getAttribute('autocomplete') || '', ph: e.placeholder })));
  const issues = fields.filter(f => !f.name).map(f => `${where}: field "${f.ph || f.type}" has no accessible name`);
  for (const [type, ac] of expected) { const f = fields.find(x => x.type === type); if (f && f.ac !== ac) issues.push(`${where}: ${type} field has autocomplete="${f.ac}", expected "${ac}"`); }
  return issues;
}
/** A control counts as finger-sized when a 44x44 square around its centre still hits it (size + hitSlop). */
async function hitArea(page, locator, label, issues, size = 44) {
  const el = (await locator.count()) ? await locator.first().elementHandle() : null;
  if (el) await el.scrollIntoViewIfNeeded();
  if (!el) { issues.push(`${label}: control not found (missing accessible name?)`); return; }
  const ok = await el.evaluate((node, half) => {
    const r = node.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const bad = [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]].map(([dx, dy]) => { const x = cx + dx * (half - 1), y = cy + dy * (half - 1); const e = document.elementFromPoint(x, y); return !!e && node.contains(e) ? null : `${dx},${dy}@${Math.round(x)},${Math.round(y)} hits ${e ? e.tagName + '.' + String(e.className).slice(0, 20) : 'nothing'}`; }).filter(Boolean);
    if (r.left < -1 || r.right > window.innerWidth + 1) bad.push(`outside the ${window.innerWidth}px viewport (x ${Math.round(r.left)}..${Math.round(r.right)})`);
    return bad.length ? `box ${Math.round(r.width)}x${Math.round(r.height)} ${bad.join('; ')}` : '';
  }, size / 2);
  if (ok) issues.push(`${label}: touch area is smaller than ${size}x${size} (${ok})`);
}

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

  // browser tab titles stay meaningful after the JS loads (React Navigation used to overwrite them with "undefined")
  page = await newPage();
  await open(page);
  await page.waitForTimeout(500);
  if ((await page.title()) !== 'Maak') throw new Error(`app tab title is "${await page.title()}"`);
  await vis(page, 'Browse services').click();
  await must(page, 'Top rated');
  if ((await page.title()) !== 'Maak') throw new Error(`app tab title after navigating is "${await page.title()}"`);
  await page.context().close();
  page = await newPage();
  await page.goto('http://localhost:4174/');
  await must(page, 'Administration panel');
  await page.waitForTimeout(500);
  if ((await page.title()) !== 'Maak Admin') throw new Error(`admin tab title is "${await page.title()}"`);
  await page.context().close();
  ok('browser tab titles are "Maak" and "Maak Admin" (never "undefined")');

  // home sections, verified badge, currency and "bookings not open" experience
  page = await newPage();
  await open(page);
  await vis(page, 'Browse services').click();
  await must(page, 'Top rated');
  await must(page, 'New on Maak');
  const topSection = await page.evaluate(() => { const t = [...document.querySelectorAll('div')].find(d => d.textContent === 'Top rated'); return t ? 'found' : ''; });
  if (!topSection) throw new Error('Top rated heading missing');
  // "Top rated" carries only rated providers; unrated newcomers are listed under "New on Maak" (never hidden)
  const order = await page.evaluate(() => { const txt = document.body.innerText; return { top: txt.indexOf('Top rated'), neu: txt.indexOf('New on Maak'), karim: txt.indexOf('Karim Benali'), must: txt.indexOf('Mustapha Alami') }; });
  if (!(order.top < order.karim && order.karim < order.neu && order.neu < order.must)) throw new Error('Home sections are not consistent: ' + JSON.stringify(order));
  const cardPrice = await page.locator('text=/From (MAD|\\u00a0)?\\s?150/').count();
  if (!cardPrice) throw new Error('starting price must show a currency, e.g. "From MAD 150"');
  if (await page.getByText('120.00', { exact: false }).count()) throw new Error('raw price "120.00" without currency is shown');
  if (!(await vis(page, 'Bookings not open yet').count())) throw new Error('closed listing must be labelled on its card');
  await shot(page, 'home-sections');
  await vis(page, 'Mustapha Alami').click();
  await must(page, 'has not opened their working hours');
  const bookDisabled = await page.locator('[aria-disabled="true"]:has-text("Book now")').count();
  if (!bookDisabled) throw new Error('Book now must be disabled when the provider has no working hours');
  if (await page.locator('text="Verified" >> visible=true').count() === 0) throw new Error('approved provider must show the verified badge');
  const msgEnabled = await page.locator('[aria-label="Message"][aria-disabled="true"]').count();
  if (msgEnabled) throw new Error('messaging must stay possible when booking is closed');
  await shot(page, 'provider-closed');
  await page.goBack().catch(() => {});
  await page.context().close();
  // a failed request is not "empty": reviews / work photos that could not be loaded say so and can be retried
  be.state.failReviews = true; be.state.failPortfolio = true;
  page = await newPage();
  await open(page);
  await vis(page, 'Browse services').click();
  await must(page, 'Top rated');
  await vis(page, 'Karim Benali').click();
  await must(page, 'Book now');
  await must(page, 'Could not load the reviews');
  await must(page, 'Could not load the work photos');
  if (await page.locator('text="No reviews yet." >> visible=true').count()) throw new Error('a failed reviews request must not read as "no reviews"');
  await shot(page, 'provider-load-failed');
  be.state.failReviews = false; be.state.failPortfolio = false;
  while (await page.locator('text="Try again" >> visible=true').count()) { await page.locator('text="Try again" >> visible=true').first().click(); await page.waitForTimeout(400); }
  await must(page, 'No reviews yet.');
  await must(page, '1 / 4');
  if (await page.locator('text=/Could not load/ >> visible=true').count()) throw new Error('error banners must disappear after a successful retry');
  ok('reviews and work photos: a failed load shows a retry, and recovers');
  await page.context().close();
  // a listing the server did not confirm as verified never gets the badge
  page = await newPage();
  await open(page);
  await vis(page, 'Browse services').click();
  await must(page, 'New on Maak');
  await vis(page, 'Unverified Uri').click();
  await must(page, 'Peintre');
  if (await page.locator('text="Verified" >> visible=true').count() > 0) throw new Error('unverified provider shows the Verified badge');
  ok('home sections, currency, closed-booking experience and verified badge are correct');
  await page.context().close();

  // accessibility + touch targets on a 320px phone
  {
    const issues = [];
    page = await newPage('en-US', { width: 320, height: 640 });
    await open(page);
    await vis(page, 'Sign in', true).click();
    await must(page, 'Welcome back');
    issues.push(...await auditFields(page, 'login', [['password', 'current-password']]));
    await shot(page, 'login-320');
    await hitArea(page, page.locator('[aria-label="Back"]:visible'), 'login: back button', issues);
    await hitArea(page, page.locator('[aria-label="Show password"]:visible'), 'login: show-password toggle', issues);
    await page.context().close();
    page = await newPage('en-US', { width: 320, height: 640 });
    await open(page);
    await vis(page, 'Create a customer account').click();
    await must(page, 'Full name');
    issues.push(...await auditFields(page, 'signup', [['password', 'new-password']]));
    await page.context().close();
    page = await newPage('en-US', { width: 320, height: 640 });
    await page.goto('http://localhost:4174/');
    await must(page, 'Administration panel');
    issues.push(...await auditFields(page, 'admin login', [['password', 'current-password']]));
    await page.context().close();
    page = await newPage('en-US', { width: 320, height: 640 });
    await open(page);
    await login(page, 'customer@t.co');
    await must(page, 'Top rated');
    await vis(page, 'Karim Benali').click();
    await must(page, 'Book now');
    for (const [name, label] of [['Back', 'provider: back'], ['Report', 'provider: report'], ['Favourites', 'provider: favourite']]) await hitArea(page, page.locator(`[aria-label="${name}"]:visible`), label, issues);
    await page.locator('[aria-label="Report"]:visible').first().click();
    await must(page, 'Spam');
    await hitArea(page, page.locator('[aria-label="Close"]:visible'), 'report sheet: close', issues);
    await page.context().close();
    if (issues.length) throw new Error('accessibility issues:\n  - ' + issues.join('\n  - '));
    ok('accessibility: field names, autocomplete tokens and 44px touch areas at 320px');
  }

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
  await page.getByText(/^[A-Z][a-z]{2,3}\.?,? \d+ [A-Za-z]{3,5}\.?$/).nth(1).click(); // tomorrow: today may have no future slots
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
  // bookings: pagination past 40 rows, search, filters, and the money rules (mark paid / refund) mirrored from the database
  await vis(page, 'Dashboard', true).click().catch(() => {});
  await vis(page, 'Bookings', true).click();
  await must(page, 'Showing 40 of 95');
  await vis(page, 'Load more', true).click(); await must(page, 'Showing 80 of 95');
  await vis(page, 'Load more', true).click(); await must(page, 'Showing 95 of 95');
  if (await page.locator('text="Load more" >> visible=true').count()) throw new Error('"Load more" must disappear when everything is loaded');
  await page.locator('input:visible').first().fill('Client 77'); await must(page, 'Showing 1 of 1');
  await page.locator('input:visible').first().fill(''); await must(page, 'Showing 40 of 95');
  const history = Array.from({ length: 95 }, (_, i) => { const n = i + 1; const status = ['completed', 'pending', 'cancelled', 'accepted', 'completed', 'rejected'][i % 6]; return { n, status, paid: status === 'completed' && n % 5 === 0 }; });
  const closed = history.filter(h => ['cancelled', 'rejected'].includes(h.status)).length;
  const toCollect = history.filter(h => h.status === 'completed' && !h.paid).length;
  await vis(page, 'To collect', true).click(); await must(page, `of ${toCollect}`);
  const shown = Math.min(40, toCollect);
  const paidButtons = await page.locator('text="Mark as paid" >> visible=true').count();
  if (paidButtons !== shown) throw new Error(`every collectable booking must offer "Mark as paid" (buttons ${paidButtons}, expected ${shown})`);
  if (await page.locator('text="Cancel booking" >> visible=true').count()) throw new Error('a completed booking must not offer cancellation');
  await vis(page, 'Cancelled / declined', true).click(); await must(page, `Showing ${Math.min(40, closed)} of ${closed}`);
  if (await page.locator('text="Mark as paid" >> visible=true').count() || await page.locator('text="Mark refunded" >> visible=true').count()) throw new Error('cancelled or declined bookings must not offer any payment action');
  await vis(page, 'Completed', true).click(); await must(page, 'Mark refunded');
  await vis(page, 'To collect', true).click(); await must(page, `of ${toCollect}`);
  await vis(page, 'Mark as paid', true).click();
  await vis(page, 'Save', true).click();
  await must(page, `of ${toCollect - 1}`);
  ok('admin: bookings paginate, search, filter, and payment actions follow the money rules');
  await vis(page, 'Dashboard', true).click();
  // a pending provider without identity documents cannot be approved from the UI (the database refuses it too)
  await vis(page, 'Provider applications to review').click();
  await must(page, 'Cannot approve yet');
  if (await page.locator('[aria-disabled="true"]:has-text("Approve")').count() === 0) throw new Error('Approve must be disabled without documents');
  ok('admin: approval blocked while identity documents are missing');
  await vis(page, 'Dashboard', true).click();
  // an announcement that reaches nobody is reported as such, not as a success
  await vis(page, 'More', true).click();
  await page.locator('text="Announcements" >> visible=true').last().click(); // the More sheet is on top of the dashboard tile
  await page.locator('input:visible').first().fill('Maintenance');
  await page.locator('textarea:visible').first().fill('Short downtime tonight');
  await vis(page, 'Send announcement', true).click();
  await vis(page, 'Send now', true).click();
  await must(page, 'Nothing was sent');
  if (await page.getByText(/delivered to/).count() > 0) throw new Error('zero recipients must not look like success');
  ok('admin: announcement with zero recipients is a warning, not a success');
  await vis(page, 'Dashboard', true).click();
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

  // working hours: a failed save never leaves the switch showing something that was not saved
  page = await newPage();
  await open(page);
  await login(page, 'provider@t.co');
  await must(page, 'Completed jobs');
  await vis(page, 'Working hours', true).click();
  await must(page, 'Saturday');
  const switches = page.locator('[role="switch"]:visible');
  if ((await switches.count()) !== 7) throw new Error('one switch per day expected');
  await switches.nth(0).click();                       // Saturday: close
  await page.locator('text="Save" >> visible=true').nth(0).click();
  await must(page, 'Saved');
  be.state.failAvailabilityDay = 0;                     // Sunday: the server refuses
  await switches.nth(1).click();
  if (await switches.nth(1).isChecked()) throw new Error('the switch should follow the tap before saving');
  await page.locator('text="Save" >> visible=true').nth(1).click();
  await must(page, 'Something went wrong');
  await page.waitForTimeout(300);
  if (!(await switches.nth(1).isChecked())) throw new Error('a refused save must put the switch back to what the server has');
  if (await switches.nth(0).isChecked()) throw new Error('the saved day must stay closed');
  be.state.failAvailabilityDay = undefined;
  ok('working hours: saved days stay saved, a refused save reverts the switch');
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
  // price rules: set after accepting, change freely before work starts, locked once the service starts
  await must(page, 'Set price');
  await vis(page, 'Set price', true).click();
  await page.locator('input:visible').first().fill('150');
  await vis(page, 'Save', true).click();
  await must(page, 'Change price');
  await must(page, 'need to change the time or cancel'.replace(/^n/, 'N'));
  await vis(page, 'Start service', true).click();
  await must(page, 'Mark as completed');
  if (await page.locator('text="Change price" >> visible=true').count()) throw new Error('an agreed price must not be editable once the service started');
  await must(page, 'can no longer be changed');
  ok('provider price rules: editable until work starts, then locked');
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
