const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'position-size-qa');

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5197', '--strictPort'], {
    cwd: root, env: { ...process.env, VITE_SUPABASE_URL: 'https://position-qa.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture-placeholder' }, stdio: 'ignore', windowsHide: true,
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://position-qa.supabase.co/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await expect(async () => expect((await page.request.get('http://127.0.0.1:5197')).ok()).toBeTruthy()).toPass({ timeout: 30000 });
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.goto('http://127.0.0.1:5197/preview/tools/position-size-calculator');
      const balance = page.getByRole('spinbutton', { name: 'Account balance', exact: true });
      const risk = page.getByRole('spinbutton', { name: 'Risk percentage', exact: true });
      const stop = page.getByRole('spinbutton', { name: 'Stop loss distance', exact: true });
      const slider = page.getByRole('slider');
      const symbol = page.getByRole('combobox', { name: 'Trading instrument' });
      await balance.fill('10000');
      await stop.fill('30');
      await symbol.selectOption('XAUUSD');
      await result('0.33', '3.33', '33.33', '$100.00');
      await expect(page.getByText('Pip size: 0.1')).toBeVisible();
      await expect(page.getByText('Pip value: $10.00/pip/lot')).toBeVisible();
      await expect(page.getByText(/round down to 0.33 standard lots for \$99.00 loss/)).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(out, `gold-${width}.png`), fullPage: true });
      for (const [value, lots, mini, micro, amount] of [
        ['0.6', '0.2', '2', '20', '$60.00'], ['0.75', '0.25', '2.5', '25', '$75.00'],
        ['1.25', '0.42', '4.17', '41.67', '$125.00'], ['1.4', '0.47', '4.67', '46.67', '$140.00'],
        ['1.65', '0.55', '5.5', '55', '$165.00'],
      ]) {
        await risk.fill(value);
        await expect(slider).toHaveValue(value);
        await result(lots, mini, micro, amount);
      }
      await slider.press('ArrowRight');
      await expect(risk).toHaveValue('1.75');
      await slider.press('ArrowLeft');
      await expect(risk).toHaveValue('1.5');
      await risk.fill('0.5');
      for (const value of ['0.75', '1', '1.25', '1.5', '1.75', '2']) {
        await slider.press('ArrowRight');
        await expect(risk).toHaveValue(value);
        await expect(slider).toHaveValue(value);
      }
      const box = await slider.boundingBox();
      await slider.click({ position: { x: box.width * 0.63, y: box.height / 2 } });
      const pointer = Number(await slider.inputValue());
      expect(pointer).toBeGreaterThan(5);
      expect(pointer).toBeLessThan(7);
      expect(Number.isInteger(pointer / 0.25)).toBe(true);
      await expect(risk).toHaveValue(String(pointer));
      for (const value of ['0.01', '0.755', '15.65', '100']) {
        await risk.fill(value);
        await expect(slider).toHaveValue(value);
      }
      await slider.press('ArrowRight');
      await expect(risk).toHaveValue('100');
      await risk.fill('1');
      await balance.fill('20000');
      await result('0.67', '6.67', '66.67', '$200.00');
      await stop.fill('60');
      await result('0.33', '3.33', '33.33', '$200.00');
      await page.getByLabel('Use custom pip value').check();
      await expect(page.getByTestId('standard-lots')).toHaveCount(0);
      await page.getByLabel('Pip value in USD per standard lot').fill('20');
      await result('0.17', '1.67', '16.67', '$200.00');
      await page.getByLabel('Use custom pip value').uncheck();
      for (const value of ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD']) {
        await symbol.selectOption(value);
        await result('0.33', '3.3', '33', '$200.00', '$198.00');
        await expect(page.getByText('Pip size: 0.0001')).toBeVisible();
      }
      for (const value of ['-1', '0', '101', '']) {
        await risk.fill(value);
        await expect(page.getByTestId('standard-lots')).toHaveCount(0);
      }
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(balance).toHaveValue('');
      await expect(risk).toHaveValue('1');
      console.log(`${width}px: Gold reference, Forex regression, decimal input, keyboard/pointer steps, bounds, custom pip and reset passed`);
    }
    expect(errors).toEqual([]);
    async function result(lots, mini, micro, amount, loss = amount) {
      for (const [id, value] of [['standard-lots', lots], ['mini-lots', mini], ['micro-lots', micro], ['risk-amount', amount], ['loss-at-stop', loss]]) {
        await expect(page.getByTestId(id)).toHaveText(value);
      }
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
