const { chromium, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.resolve(root, '../session-clock-qa');
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = require('child_process').spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5192', '--strictPort'], { cwd: root, env: { ...process.env, VITE_SUPABASE_URL: 'https://sessions-qa.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture-placeholder' }, stdio: 'ignore', windowsHide: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true }).catch(e => { server.kill(); throw e; });
  try {
    await new Promise(r => setTimeout(r, 1200));
    for (const timezoneId of ['Asia/Kolkata', 'America/New_York']) {
      const context = await browser.newContext({ timezoneId });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('https://sessions-qa.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
      await page.clock.install({ time: new Date('2026-10-08T05:29:59Z') });
      await page.clock.pauseAt(new Date('2026-10-08T05:29:59Z'));
      await page.goto('http://127.0.0.1:5192/preview/analysis');
      const section = page.getByRole('region', { name: 'Session Performance' });
      await expect(section).toBeVisible();
      await expect(page.locator('.an-session-timeline')).toHaveAttribute('aria-label', 'IST market sessions. Active: Off session');
      const before = await page.locator('.an-session-grid').innerText();
      await page.clock.runFor(1000);
      await expect(page.locator('.an-now')).toHaveAttribute('title', '11:00:00 IST · London');
      await expect(page.locator('.an-market-row[aria-current=time]')).toHaveCount(1);
      if (Math.abs(await page.locator('.an-now').evaluate(e => parseFloat(e.style.left)) - (11 / 24 * 100)) > 0.000001) throw Error('Incorrect IST position');
      await expect(section).toContainText('UTC+05:30');
      await expect(page.locator('.an-market-new-york .an-market-bar')).toHaveCount(1);
      if (await page.locator('.an-session-grid').innerText() !== before) throw Error('Clock changed metrics');
      if (timezoneId === 'Asia/Kolkata') for (const width of [320, 390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1100 });
        await page.evaluate(() => document.fonts.ready);
        await section.screenshot({ path: path.join(out, `sessions-${width}.png`) });
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error(`Page overflow at ${width}`);
        if (await page.locator('.an-session-timeline').evaluate(e => e.scrollWidth > e.clientWidth)) throw Error(`Timeline overflow at ${width}`);
        const overlap = await page.locator('.an-session-times').evaluate(e => {
          const rects = [...e.children].filter(c => getComputedStyle(c).display !== 'none').map(c => c.getBoundingClientRect());
          return rects.some((a, i) => rects.slice(i + 1).some(b => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
        });
        if (overlap) throw Error(`Time labels overlap at ${width}`);
        console.log(`${width}px: three lanes, complete cards, no label collisions or overflow`);
      }
      await page.clock.setSystemTime(new Date('2026-10-08T18:29:59Z'));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(page.locator('.an-clock-time time')).toHaveText('23:59:59IST');
      await page.clock.runFor(1000);
      await expect(page.locator('.an-now')).toHaveAttribute('title', '00:00:00 IST · Off session');
      await expect(page.locator('.an-clock-time')).toContainText('Fri, 9 Oct 2026');
      if (await page.locator('.an-now').evaluate(e => parseFloat(e.style.left)) !== 0) throw Error('Midnight did not reset');
      await page.clock.setSystemTime(new Date('2026-10-08T22:00:00Z'));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await expect(page.locator('.an-now')).toHaveAttribute('title', '03:30:00 IST · Off session');
      if (errors.length) throw Error(errors.join('\n'));
      console.log(`${timezoneId}: live boundary, IST midnight/date rollover, focus/visibility recovery passed`);
      await context.close();
    }
  } finally { await browser.close(); server.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
