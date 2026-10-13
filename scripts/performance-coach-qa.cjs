const { chromium, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const api = 'https://coach-qa.supabase.co';
const origin = 'http://127.0.0.1:5198';
const uid = '11111111-1111-4111-8111-111111111111';
const user = { id: uid, email: 'coach-qa@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const opened = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const closed = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const trade = { id: 'trade-1', user_id: uid, symbol: 'XAUUSD', direction: 'Long', entry_price: 4100, exit_price: 4110, lot_size: .1, pnl: 100, stop_loss: 4090, take_profit: 4120, open_time: opened, close_time: closed, session: 'London', source: 'manual', created_at: opened, updated_at: closed };
const journal = { id: 'journal-1', trade_id: trade.id, user_id: uid, pre_trade_notes: 'Waited for confirmation', post_trade_notes: 'Followed the plan', emotions: 'Calm', lessons: 'Keep waiting for confirmation', tags: 'planned', strategy_setup: '{}', risk_reward: '1:2', rating: 4, created_at: opened };
const checklist = { id: 'checklist-1', trade_id: trade.id, user_id: uid, checked_higher_tf: true, risk_within_limits: true, fits_plan: true, key_levels: true, news_checked: true };

async function main() {
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5198', '--strictPort'], {
    cwd: root, env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture' }, stdio: 'ignore', windowsHide: true,
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(({ user }) => {
      localStorage.setItem('sb-coach-qa-auth-token', JSON.stringify({ access_token: 'fixture', refresh_token: 'fixture', expires_at: Math.floor(Date.now() / 1000) + 360000, token_type: 'bearer', user }));
    }, { user });
    let mode = 'success';
    let generationCalls = 0;
    let lastPrompt;
    await page.route(`${api}/**`, async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user });
      if (url.pathname.endsWith('/functions/v1/performance-coach')) {
        const body = request.postDataJSON();
        if (body.action === 'status') return route.fulfill({ json: { ready: true, limitRemaining: 10 } });
        generationCalls++;
        lastPrompt = JSON.parse(body.prompt);
        if (mode === 'network') return route.abort('failed');
        if (mode !== 'success') return route.fulfill({ status: mode === 'billing' ? 402 : 502, json: { code: mode, message: mode === 'billing' ? 'OpenRouter has insufficient credits.' : 'The configured model is unavailable.', retryable: false } });
        const evidenceId = lastPrompt.evidence[0].id;
        const report = {
          verdict: { headline: 'Review your documented setup', summary: 'One recorded trade followed the plan; the sample is too small for a trend.', condition: 'Building a foundation', evidenceIds: [evidenceId] },
          insights: [{ id: 'document-setup', title: 'Keep recording your setup', priority: 'Watch', dimension: 'discipline', interpretation: 'One checklist is recorded, but more trades are needed.', evidenceIds: [evidenceId], rootCause: null, action: 'Record a checklist for five trades.', measurement: 'Five checklists recorded.' }],
          dimensions: ['discipline', 'risk', 'execution', 'psychology', 'consistency'].map(dimension => ({ dimension, assessment: 'The available sample is limited.', evidenceIds: [], confidence: 'Insufficient evidence' })),
          nextPlan: { focus: 'Document the next five trades', items: [{ label: 'Main rule', instruction: 'Record your plan before each entry.', evidenceIds: [evidenceId] }] },
          limitations: ['Only one trade is available.'],
        };
        return route.fulfill({ json: { report: JSON.stringify(report), timestamp: new Date().toISOString() } });
      }
      const table = url.pathname.split('/').pop();
      const data = { trades: [trade], journals: [journal], checklists: [checklist], screenshots: [], trading_rules: [], rule_violations: [], user_settings: [] }[table] || [];
      return route.fulfill({ json: data });
    });
    await expect.poll(async () => { try { return (await page.request.get(origin)).ok(); } catch { return false; } }, { timeout: 30000 }).toBe(true);
    await page.goto(`${origin}/ai-report`);
    await expect(page.getByRole('button', { name: 'Coach ready' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate Performance Report' })).toBeEnabled();
    await page.getByRole('button', { name: 'All Time', exact: true }).click();
    await page.locator('summary').filter({ hasText: 'Customize analysis' }).click();
    await page.getByLabel('Screenshot coverage').check();
    await page.getByRole('button', { name: 'Generate Performance Report' }).dblclick();
    await expect(page.getByText('Review your documented setup')).toBeVisible();
    expect(generationCalls).toBe(1);
    expect(lastPrompt.includedSources.screenshots).toBe(true);
    expect(lastPrompt.records[0].post).toBe('Followed the plan');
    await page.reload();
    await expect(page.getByText('Review your documented setup')).toBeVisible();
    await page.getByRole('button', { name: /Past reviews/ }).click();
    await expect(page.getByRole('dialog').getByText('Review your documented setup')).toBeVisible();
    await page.getByRole('dialog').getByText('Review your documented setup').click();
    mode = 'billing';
    await page.getByRole('button', { name: 'Generate Performance Report' }).click();
    await expect(page.getByText('OpenRouter has insufficient credits.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
    await expect(page.getByText('Review your documented setup')).toBeVisible();
    mode = 'invalid_model';
    await page.getByRole('button', { name: 'Generate Performance Report' }).click();
    await expect(page.getByText('The configured model is unavailable.')).toBeVisible();
    mode = 'network';
    await page.getByRole('button', { name: 'Generate Performance Report' }).click();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(pageErrors).toEqual([]);
    console.log('Coach periods, sources, generation, saved history, billing, model, network, and duplicate-click checks passed.');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
