// Browser acceptance test against fixture responses. Never reads or writes a real account.
const { chromium, expect } = require('@playwright/test');
const XLSX = require('xlsx');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.resolve(root, '../journal-qa');
const uid = '11111111-1111-4111-8111-111111111111', api = 'https://journal-qa.supabase.co';
const user = { id: uid, email: 'journal@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const trades = Array.from({ length: 18 }, (_, i) => ({ id: `t-${String(i).padStart(3, '0')}`, user_id: uid, symbol: i % 3 ? 'XAUUSD' : 'EURUSD', direction: i % 2 ? 'Long' : 'Short', entry_price: 4625.12345, exit_price: 4630.25, lot_size: 0.5, pnl: i % 2 ? 523 : -30.3, open_time: new Date(Date.UTC(2026, 9, 7 - i, 10)).toISOString(), close_time: new Date(Date.UTC(2026, 9, 7 - i, 11)).toISOString(), session: 'London', source: 'manual', stop_loss: 4600, take_profit: 4680, created_at: '', updated_at: '' }));
const journals = trades.filter((_, i) => i % 2 === 0).map((t, i) => ({ id: `j-${String(i).padStart(3, '0')}`, trade_id: t.id, user_id: uid, pre_trade_notes: 'Price reached the H4 demand zone. Wait for a liquidity sweep, then a clear M1 confirmation.\nRisk stays below 1%.', post_trade_notes: 'Execution was patient, with no slippage. "Plan first, trade second."', emotions: 'Calm, confident · धैर्य', lessons: 'Wait for the retest. Preserve capital before chasing profit.', tags: 'planned,London', rating: 8, risk_reward: '1:3', strategy_setup: JSON.stringify({ htf_tf: 'H4', htf_level: 'RBS', ltf_tf: 'M5', ltf_level: 'TJL 1', conf_tf: 'M1', conf_type: 'CC Engulfing', confluences: ['FIB Zone', 'Liquidity Sweep'], fib_tf: 'H1', demand_supply: 'Demand — M5', market_session: 'London', bias: 'Bullish', execution_type: 'Limit Order' }), created_at: '', updated_at: '' }));
const checklists = journals.map((j, i) => ({ id: `c-${String(i).padStart(3, '0')}`, trade_id: j.trade_id, user_id: uid, checked_higher_tf: true, risk_within_limits: true, fits_plan: true, key_levels: true, news_checked: false }));
const screenshots = [{ id: 's-1', trade_id: trades[0].id, user_id: uid, image_url: 'http://127.0.0.1:5191/fixture-chart.svg' }, { id: 's-2', trade_id: trades[0].id, user_id: uid, image_url: 'http://127.0.0.1:5191/missing-image.png' }];
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = require('child_process').spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5191'], { cwd: root, env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'journal-qa-placeholder' }, stdio: 'ignore', windowsHide: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true }).catch(error => { server.kill(); throw error; });
  const page = await browser.newPage(); const errors = []; let failExport = false, writes = 0;
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-08T00:00:00Z'));
  await page.addInitScript(({ user }) => { localStorage.setItem('sb-journal-qa-auth-token', JSON.stringify({ access_token: 'fixture-token', refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now()/1000)+360000, expires_in: 360000, token_type: 'bearer', user })); localStorage.setItem('theme', 'dark'); }, { user });
  await page.route(`${api}/**`, async route => {
    const url = new URL(route.request().url()), table = url.pathname.split('/').pop();
    if (url.pathname.includes('/rest/') && route.request().method() !== 'GET') writes++;
    if (url.searchParams.get('limit') === '500' && url.searchParams.get('user_id') !== `eq.${uid}`) throw Error('Export query missing user scope');
    if (url.pathname.includes('/storage/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (failExport && url.searchParams.get('limit') === '500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Fixture failure"}' });
    let data = ({ trades, journals, checklists, screenshots })[table] || [];
    if (Array.isArray(data)) {
      for (const key of ['trade_id', 'id']) { const filter = url.searchParams.get(key); if (filter?.startsWith('eq.')) data = data.filter(r => r[key] === filter.slice(3)); if (filter?.startsWith('gt.')) data = data.filter(r => r[key] > filter.slice(3)); }
      if (url.searchParams.get('order')?.startsWith('id')) data = [...data].sort((a,b) => a.id.localeCompare(b.id)).slice(0, 4); // Exercise shortened API pages.
      if (route.request().headers().accept?.includes('vnd.pgrst.object')) data = data[0] || null;
    }
    if (table === 'user') data = user;
    if (table === 'user_settings') data = { user_id: uid, display_name: 'Journal QA', timezone: 'Asia/Kolkata', theme: 'dark', currency: 'USD' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.route('**/fixture-chart.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500"><rect width="1200" height="500" fill="#131924"/><text x="40" y="50" fill="#eee" font-size="24">XAUUSD - Entry confirmation</text><path d="M40 400 L180 320 L280 350 L440 220 L520 260 L670 170 L800 200 L960 95 L1160 120" fill="none" stroke="#3b82f6" stroke-width="6"/><rect x="400" y="260" width="700" height="45" fill="#2563eb" opacity=".2"/><text x="450" y="290" fill="#93c5fd" font-size="18">Demand zone</text></svg>' }));
  await page.route('**/missing-image.png', route => route.fulfill({ status: 404, body: 'missing' }));
  try {
    await new Promise(r => setTimeout(r, 1400));
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 950 }); await page.goto('http://127.0.0.1:5191/journal');
      await expect(page.getByRole('button', { name: 'Export Journal', exact: true })).toBeVisible();
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      if (width < 1280) {
        await expect(page.locator('.journal-editor')).toBeHidden();
        await page.getByRole('button', { name: 'Open EURUSD journal', exact: true }).first().click();
        await expect(page.locator('.journal-list')).toBeHidden();
        await expect(page.locator('.journal-editor')).toBeVisible();
        if (await page.locator('.journal-editor').evaluate(e => e.scrollTop) !== 0) throw Error('Editor not at top');
        await page.screenshot({ path: path.join(out, `editor-${width}.png`) });
        await page.getByRole('button', { name: 'Trade Journal', exact: true }).click();
        await expect(page.locator('.journal-list')).toBeVisible();
      }
      await page.screenshot({ path: path.join(out, `journal-${width}.png`) });
      await page.getByRole('button', { name: 'Export Journal', exact: true }).click();
      await expect(page.getByText('1 trade ready to export', { exact: true })).toBeVisible();
      await page.getByRole('radio', { name: /All Journaled Trades/ }).check();
      await expect(page.getByText('9 trades ready to export', { exact: true })).toBeVisible();
      await page.getByRole('radio', { name: /All Trades/ }).check();
      await expect(page.getByText('18 trades ready to export', { exact: true })).toBeVisible();
      await page.getByRole('radio', { name: /Selected Trades/ }).check();
      await expect(page.getByRole('button', { name: 'Export 0 trades', exact: true })).toBeDisabled();
      await page.getByRole('checkbox', { name: 'Select EURUSD t-000', exact: true }).check();
      await page.getByRole('checkbox', { name: 'Select XAUUSD t-001', exact: true }).check();
      await expect(page.getByText('2 trades ready to export', { exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(out, `export-${width}.png`) });
      const overflow = await page.evaluate(() => ({ screen: document.documentElement.scrollWidth > innerWidth, dialog: (() => { const d = document.querySelector('[role=dialog]'); return d.scrollWidth > d.clientWidth; })() }));
      if (overflow.screen || overflow.dialog) throw Error(`Overflow at ${width}: ${JSON.stringify(overflow)}`);
      await page.keyboard.press('Escape');
      console.log(`${width}px: navigation, all scope counts, selection, responsive dialog passed`);
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.getByRole('textbox', { name: 'Search journal symbol' }).fill('EUR');
    await page.getByRole('button', { name: 'Export Journal', exact: true }).click();
    await expect(page.getByText('1 trade ready to export', { exact: true })).toBeVisible();
    await page.getByRole('radio', { name: /All Trades/ }).check();
    await expect(page.getByText('6 trades ready to export', { exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: /Use current list filters/ }).uncheck();
    await expect(page.getByText('18 trades ready to export', { exact: true })).toBeVisible();
    async function download(format, count, file) {
      await page.getByRole('radio', { name: format, exact: true }).check();
      const event = page.waitForEvent('download'); await page.getByRole('button', { name: `Export ${count} trade${count === 1 ? '' : 's'}`, exact: true }).click();
      await (await event).saveAs(path.join(out, file));
    }
    await download('Excel', 18, 'journal.xlsx');
    const wb = XLSX.readFile(path.join(out, 'journal.xlsx'));
    if (XLSX.utils.sheet_to_json(wb.Sheets['Journal entries']).length !== 18) throw Error('Incomplete workbook');
    await page.getByRole('button', { name: 'Export Journal', exact: true }).click();
    await expect(page.getByText('1 trade ready to export', { exact: true })).toBeVisible();
    await download('CSV', 1, 'journal.csv');
    const csv = fs.readFileSync(path.join(out, 'journal.csv'), 'utf8');
    if (!csv.includes('Wait for a liquidity sweep') || !csv.includes('Execution Type')) throw Error('Missing journal fields');
    await page.getByRole('button', { name: 'Export Journal', exact: true }).click();
    await expect(page.getByText('1 trade ready to export', { exact: true })).toBeVisible();
    await download('PDF', 1, 'journal.pdf');
    await expect(page.getByText(/1 screenshot was unavailable/)).toBeVisible();
    // Stress pagination with multiline international notes and unbroken text.
    const original = journals[0].pre_trade_notes;
    journals[0].pre_trade_notes = ('Long journal review: keep every detail on the page. '.repeat(20) + '\n').repeat(8) + 'x'.repeat(300) + '\nEND OF LONG NOTE';
    await page.getByRole('button', { name: 'Export Journal', exact: true }).click();
    await expect(page.getByText('1 trade ready to export', { exact: true })).toBeVisible();
    await download('PDF', 1, 'journal-long.pdf'); journals[0].pre_trade_notes = original;
    failExport = true;
    await page.getByRole('button', { name: 'Export Journal', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('could not load your complete journal');
    await expect(page.getByRole('button', { name: /Export 0 trades/ })).toBeDisabled();
    failExport = false; await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByText('1 trade ready to export', { exact: true })).toBeVisible();
    await page.locator('details > summary').click();
    for (const label of ['Trade details', 'Analysis & reflections', 'Risk, rating & tags', 'Execution checklist', 'Strategy & market structure', 'Screenshots']) await page.getByRole('checkbox', { name: label, exact: true }).uncheck();
    await expect(page.getByRole('button', { name: 'Export 1 trade', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'Search journal symbol' }).fill('');
    await page.getByLabel('Journal date range', { exact: true }).selectOption('custom');
    await page.getByLabel('Journal start date').fill('2026-10-07');
    await page.getByLabel('Journal end date').fill('2026-10-07');
    await expect(page.getByRole('button', { name: /Open .* journal/ })).toHaveCount(1);
    await page.getByRole('button', { name: 'Export Journal', exact: true }).click();
    await expect(page.getByText('1 trade ready to export', { exact: true })).toBeVisible();
    await page.getByRole('radio', { name: /All Trades/ }).check();
    await page.getByRole('checkbox', { name: /Use current list filters/ }).check();
    await expect(page.getByText('All statuses · 2026-10-07 to 2026-10-07')).toBeVisible();
    await expect(page.getByText('1 trade ready to export', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByLabel('Journal start date').fill('2026-10-08');
    await expect(page.getByText('End date must be on or after start date.')).toBeVisible();
    await page.getByRole('button', { name: 'Export Journal', exact: true }).click();
    await expect(page.getByText('0 trades ready to export', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Current Trade/ })).toBeDisabled();
    if (writes) throw Error('Export modified user data');
    if (errors.length) throw Error(errors.join('\n'));
    console.log('CSV, Excel, PDF downloads; complete paginated data; filter opt-out; screenshots/fallback; long notes; retry and read-only behavior passed.');
  } catch (e) { await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); console.error((await page.locator('body').innerText()).slice(-6000)); throw e; }
  finally { await browser.close(); server.kill(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
