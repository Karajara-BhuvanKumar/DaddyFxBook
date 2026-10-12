const { chromium, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'tools-qa');

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = require('child_process').spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { cwd: root, env: { ...process.env, VITE_SUPABASE_URL: 'https://tools-qa.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture-placeholder' }, stdio: 'ignore', windowsHide: true });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ timezoneId: 'America/Los_Angeles' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://tools-qa.supabase.co/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.clock.install({ time: new Date('2026-10-12T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-12T12:00:00Z'));
    await expect(async () => { const response = await page.request.get('http://127.0.0.1:5198'); expect(response.ok()).toBeTruthy(); }).toPass({ timeout: 15000 });
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.goto('http://127.0.0.1:5198/preview/tools');
      await expect(page.locator('.tool-card')).toHaveCount(2);
      await expect(page.locator('.tools-counts')).toContainText('2Available0Coming soon');
      await screenshot('tools', width);
      await page.getByRole('link', { name: 'Open Position Size Calculator' }).click();
      await page.getByRole('spinbutton', { name: 'Account balance', exact: true }).fill('10000');
      await page.getByRole('spinbutton', { name: 'Stop loss distance', exact: true }).fill('20');
      for (const [value, amount] of [['0.6', '$60.00'], ['0.75', '$75.00'], ['1.25', '$125.00'], ['1.5', '$150.00'], ['0.755', '$75.50']]) {
        await page.getByRole('spinbutton', { name: 'Risk percentage', exact: true }).fill(value);
        await expect(page.getByRole('slider')).toHaveValue(value);
        await expect(page.getByTestId('risk-amount')).toHaveText(amount);
      }
      await page.getByRole('spinbutton', { name: 'Risk percentage', exact: true }).fill('1.25');
      await page.getByRole('slider').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('spinbutton', { name: 'Risk percentage', exact: true })).toHaveValue('1.26');
      await expect(page.getByTestId('loss-at-stop')).toHaveText('$126.00');
      const sliderBox = await page.getByRole('slider').boundingBox();
      await page.getByRole('slider').click({ position: { x: sliderBox.width / 2, y: sliderBox.height / 2 } });
      const pointerRisk = Number(await page.getByRole('slider').inputValue());
      expect(pointerRisk).toBeGreaterThan(40);
      expect(pointerRisk).toBeLessThan(60);
      await expect(page.getByRole('spinbutton', { name: 'Risk percentage', exact: true })).toHaveValue(String(pointerRisk));
      await expect(page.getByTestId('risk-amount')).toHaveText((pointerRisk * 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
      await page.getByRole('spinbutton', { name: 'Risk percentage', exact: true }).fill('0.75');
      await screenshot('calculator', width);
      for (const invalid of ['-1', '0', '101', '']) {
        await page.getByRole('spinbutton', { name: 'Risk percentage', exact: true }).fill(invalid);
        await expect(page.getByTestId('standard-lots')).toHaveCount(0);
      }
      await page.getByRole('spinbutton', { name: 'Risk percentage', exact: true }).fill('1');
      await page.getByLabel('Use custom pip value').check();
      await expect(page.getByTestId('standard-lots')).toHaveCount(0);
      await page.getByLabel('Pip value in USD per standard lot').fill('5');
      await expect(page.getByTestId('standard-lots')).toHaveText('1');
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(page.getByRole('spinbutton', { name: 'Account balance', exact: true })).toHaveValue('');
      await page.getByRole('link', { name: 'Back to Tools' }).click();
      await page.getByRole('link', { name: 'Open Forex Market Hours' }).click();
      await expect(page.getByTestId('market-user-clock')).toHaveText('12:00:00');
      await expect(page.locator('.tool-session-row[aria-current=time]')).toHaveCount(2);
      await screenshot('market-hours', width);
      console.log(`${width}px: two tools, decimal risk/input/slider/results/reset, IST overlap and no overflow passed`);
    }
    await page.clock.setSystemTime(new Date('2026-10-12T23:59:59Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByTestId('market-user-clock')).toHaveText('23:59:59');
    await page.clock.runFor(1000);
    await expect(page.getByTestId('market-user-clock')).toHaveText('00:00:00');
    await expect(page.locator('.fx-user-clock')).toContainText(/Tue,? 13 Oct/);
    await expect(page.locator('.app-header-clock time')).toHaveText('00:00:00 UTC');
    await page.clock.setSystemTime(new Date('2026-10-10T08:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.fx-session-status')).toContainText('Weekend · Market closed');
    await expect(page.locator('.tool-session-row[aria-current=time]')).toHaveCount(0);
    if (errors.length) throw Error(errors.join('\n'));
    console.log('Foreign device timezone, saved/default timezone midnight rollover, weekend closure and runtime error checks passed');
    async function screenshot(name, width) {
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth, elements: [...document.querySelectorAll('.tools-page input,.tools-page select,.tool-results,.tool-field,.tool-market')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1).map(e => e.className) }));
      expect(overflow).toEqual({ page: false, elements: [] });
      await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true });
    }
  } finally { if (browser) await browser.close(); server.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
