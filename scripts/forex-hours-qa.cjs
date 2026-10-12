// Browser fixtures only. No real account or market data is accessed.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'forex-hours-qa');
const api = 'https://fx-hours-qa.supabase.co';
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'fx-hours@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = require('child_process').spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5199', '--strictPort'], { cwd: root, env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture-placeholder' }, stdio: 'ignore', windowsHide: true });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ timezoneId: 'America/Los_Angeles' });
    const errors = [];
    let timezone = 'Asia/Kolkata', timeFormat = '12h';
    page.on('pageerror', error => errors.push(error.message));
    await page.route(api + '/**', route => {
      const table = new URL(route.request().url()).pathname.split('/').pop();
      const data = table === 'user' ? user : table === 'user_settings' ? { user_id: user.id, display_name: 'Trading workspace', timezone, time_format: timeFormat, theme: 'dark', currency: 'USD', accent_color: 'blue' } : [];
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.addInitScript(user => {
      localStorage.setItem('theme', 'dark');
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
        document.head.appendChild(style);
      });
      localStorage.setItem('sb-fx-hours-qa-auth-token', JSON.stringify({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', expires_at: 2000000000, expires_in: 360000, token_type: 'bearer', user }));
    }, user);
    await page.clock.install({ time: new Date('2026-10-11T23:28:00Z') });
    await page.clock.pauseAt(new Date('2026-10-11T23:28:00Z'));
    await expect(async () => { expect((await page.request.get('http://127.0.0.1:5199')).ok()).toBeTruthy(); }).toPass({ timeout: 15000 });
    const url = 'http://127.0.0.1:5199/tools/forex-market-hours';
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.clock.setSystemTime(new Date('2026-10-11T23:28:00Z'));
      const settingsResponse = page.waitForResponse(response => response.url().includes('/rest/v1/user_settings'));
      await page.goto(url);
      await (await settingsResponse).finished();
      await settlePage();
      await jump('2026-10-11T23:28:00Z');
      await expect(page.getByTestId('market-user-clock')).toHaveText('4:58:00 am');
      await expect(page.getByTestId('sydney-clock')).toHaveText('10:28:00 am');
      await expect(page.getByTestId('tokyo-clock')).toHaveText('8:28:00 am');
      await expect(page.getByTestId('london-clock')).toHaveText('12:28:00 am');
      await expect(page.getByTestId('new-york-clock')).toHaveText('7:28:00 pm');
      await expect(page.getByTestId('london-zone')).toContainText('BST');
      await expect(page.getByTestId('new-york-zone')).toContainText('EDT');
      await expect(page.locator('.fx-session[aria-current=time]')).toHaveCount(1);
      await expect(page.locator('[data-window=overlap] h4')).toHaveText('5:30 pm – 9:30 pm');
      await expect(page.locator('[data-window=london-open] h4')).toHaveText('12:30 pm – 2:30 pm');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(out, `forex-${width}.png`), fullPage: true });
      await checkLayout(width);
      await page.getByRole('switch', { name: 'Use 24-hour time' }).click();
      await expect(page.getByTestId('market-user-clock')).toHaveText('04:58:00');
      await expect(page.locator('[data-window=overlap] h4')).toHaveText('17:30 – 21:30');
      await checkLayout(width);
      console.log(`${width}px: four local clocks, correct DST names, synchronized format toggle and no overflow/label collisions`);
    }
    const transitions = [
      ['sydney', '2026-04-04T15:59:59Z', 'AEDT', 'AEST', '02:00:00'],
      ['sydney', '2026-10-03T15:59:59Z', 'AEST', 'AEDT', '03:00:00'],
      ['london', '2026-03-29T00:59:59Z', 'GMT', 'BST', '02:00:00'],
      ['london', '2026-10-25T00:59:59Z', 'BST', 'GMT', '01:00:00'],
      ['new-york', '2026-03-08T06:59:59Z', 'EST', 'EDT', '03:00:00'],
      ['new-york', '2026-11-01T05:59:59Z', 'EDT', 'EST', '01:00:00'],
    ];
    for (const [market, before, oldZone, newZone, time] of transitions) {
      await jump(before);
      await expect(page.getByTestId(`${market}-zone`)).toHaveText(new RegExp(`^${oldZone} \\(`));
      await page.clock.runFor(1250);
      await expect(page.getByTestId(`${market}-zone`)).toHaveText(new RegExp(`^${newZone} \\(`));
      await expect(page.getByTestId(`${market}-clock`)).toHaveText(time);
    }
    await jump('2026-10-26T07:59:59Z');
    await expect(page.locator('[data-market=london]')).not.toHaveAttribute('aria-current', 'time');
    await page.clock.runFor(1250);
    await expect(page.locator('[data-market=london]')).toHaveAttribute('aria-current', 'time');
    await expect(page.getByTestId('london-countdown')).toHaveText('Closes in 09:00:00');
    await expect(page.locator('[data-window=london-open]')).toContainText('Active · ends in 02:00:00');
    await expect(page.locator('[data-window=overlap] h4')).toHaveText('17:30 – 22:30');
    await page.screenshot({ path: path.join(out, 'forex-weekday-1920.png'), fullPage: true });
    const oldMarker = await page.locator('.fx-timeline').getAttribute('style');
    await page.clock.runFor(250);
    expect(await page.locator('.fx-timeline').getAttribute('style')).not.toBe(oldMarker);
    await jump('2026-12-31T18:29:59Z');
    await page.clock.runFor(1250);
    await expect(page.getByTestId('market-user-clock')).toHaveText('00:00:00');
    await expect(page.locator('.fx-user-clock')).toContainText('1 Jan 2027');
    await expect(page.locator('[data-market=new-york]')).toContainText('31 Dec 2026');
    await jump('2026-10-24T12:00:00Z');
    await expect(page.locator('.fx-session[aria-current=time]')).toHaveCount(0);
    await expect(page.locator('[data-window=london-open]')).toContainText('26 Oct 2026');
    console.log('All six live DST transitions, exact opening boundary, moving marker, weekend next windows and year-end rollover passed');
    timezone = 'America/New_York'; timeFormat = '24h';
    await jump('2026-10-12T12:00:00Z');
    const refreshedSettings = page.waitForResponse(response => response.url().includes('/rest/v1/user_settings'));
    await page.reload();
    await (await refreshedSettings).finished();
    await settlePage();
    await jump('2026-10-12T12:00:00Z');
    await page.clock.runFor(1000);
    await expect(page.getByTestId('market-user-clock')).toHaveText(/08:00:0[01]/);
    await expect(page.locator('.app-header-clock time')).toHaveText(/08:00:0[01] EDT/);
    await expect(page.getByTestId('london-clock')).toHaveText(/13:00:0[01]/);
    await expect(page.locator('[data-window=overlap] h4')).toHaveText('08:00 – 12:00');
    await jump('2026-11-01T08:00:00Z');
    await expect(page.locator('.fx-timeline-note')).toContainText('25-hour timeline');
    await checkLayout(1920);
    for (const width of [320, 768, 1024]) { await page.setViewportSize({ width, height: 1080 }); await page.screenshot({ path: path.join(out, `forex-25h-${width}.png`), fullPage: true }); await checkLayout(width); }
    console.log('Saved timezone/format restored on reload; 25-hour DST timeline and independent local clocks passed');
    if (errors.length) throw Error(errors.join('\n'));
    async function jump(iso) { await page.clock.setSystemTime(new Date(iso)); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); }
    async function settlePage() {
      // React Suspense/query notifications use timers; allow them to settle
      // under the controlled test clock before testing exact clock boundaries.
      await expect(async () => { await page.clock.runFor(100); await expect(page.getByTestId('market-user-clock')).toBeVisible({ timeout: 300 }); }).toPass({ timeout: 20000 });
      await page.clock.runFor(100);
    }
    async function checkLayout(width) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      const collisions = await page.locator('.tool-market-axis').evaluate(element => {
        const rects = [...element.children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect());
        return rects.some((a, i) => rects.slice(i + 1).some(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
      });
      if (collisions) console.log(await page.locator('.tool-market-axis').evaluate(e => [...e.children].filter(c => getComputedStyle(c).display !== 'none').map(c => ({ text: c.textContent, classes: c.className, x: c.getBoundingClientRect().x, width: c.getBoundingClientRect().width }))));
      expect(collisions, `Axis labels collide at ${width}px`).toBe(false);
      expect(await page.locator('.fx-dashboard').evaluate(e => e.scrollWidth > e.clientWidth)).toBe(false);
    }
  } finally { if (browser) await browser.close(); server.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
