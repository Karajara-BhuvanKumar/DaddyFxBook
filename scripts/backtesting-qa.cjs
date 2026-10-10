// Exercises real routes/components against local fixtures; no account data is used.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.resolve(root, '../backtesting-qa');
const api = 'https://theme-qa.supabase.co', origin = 'http://127.0.0.1:5196';
const uid = '11111111-1111-4111-8111-111111111111';
const user = { id: uid, email: 'theme@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const trades = Array.from({ length: 48 }, (_, i) => ({ id: `t-${i}`, user_id: uid, symbol: i % 2 ? 'XAUUSD' : 'EURUSD', direction: i % 2 ? 'Long' : 'Short', entry_price: 4110.66, exit_price: 4120, lot_size: .1, pnl: i % 3 ? 192.3 : -30.3, open_time: new Date(Date.UTC(2026, 9, 8 - i, 10)).toISOString(), close_time: new Date(Date.UTC(2026, 9, 8 - i, 11)).toISOString(), session: 'London', source: 'manual', stop_loss: 4100, take_profit: 4140, created_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:00Z' }));
const journals = trades.slice(0, 12).map(t => ({ id: `j-${t.id}`, trade_id: t.id, user_id: uid, pre_trade_notes: 'Wait for confirmation at the demand zone.', post_trade_notes: 'Patient execution, followed the plan.', emotions: 'Calm and focused', lessons: 'Wait for the retest.', tags: 'planned,London', rating: 8, risk_reward: '1:3', strategy_setup: JSON.stringify({market_session:'London',htf_tf:'H4',htf_level:'RBS',ltf_tf:'M5',ltf_level:'TJL 1',conf_tf:'M1',conf_type:'CC Engulfing'}), created_at: t.created_at }));
const sessions = [{ id: 'session-1', user_id: uid, name: 'London breakout', pair: 'XAUUSD', strategy: 'Breakout', description: 'Theme acceptance fixture', created_at: '2026-10-08T00:00:00Z' }];
sessions.push(...['Gold M15 with confirmation 1m', 'Gold H4 ALL levels July', 'Gold M5 A+ Aug', 'Gold H1 20 jul 22 30', 'M15 A+ 11 aug 19 30'].map((name,i)=>({...sessions[0],id:'session-'+(i+2),name})));
const backtestTrades = trades.map((t,i) => ({ ...t, session_id: 'session-1', trade_number: i+1, pair: t.symbol, direction: i%2 ? 'long' : 'short', market_condition: i%3 ? 'Trending' : 'Ranging', outcome: t.pnl > 0 ? 'win' : 'loss', rr: 3, r_gained: t.pnl > 0 ? 3 : -1, trade_date: t.open_time, setup: `LTF: M15 TJL ${i%26+1} Confirmation: M1 CC Engulfing Confluences: SL Outside Zone and higher timeframe confirmation`, notes: 'Followed plan' }));
let settings = { user_id: uid, display_name: 'Theme QA', theme: 'dark', accent_color: 'blue', timezone: 'UTC', currency: 'USD' };
async function main() {
 fs.mkdirSync(out, { recursive: true });
 const server = require('child_process').spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host','127.0.0.1','--port','5196','--strictPort'], { cwd: root, env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture' }, stdio: 'pipe', windowsHide: true });
 server.stdout.on('data', d => process.stdout.write(d)); server.stderr.on('data', d => process.stderr.write(d));
 const browser = await chromium.launch({ channel: 'msedge', headless: true }).catch(error => { server.kill(); throw error; });
 let page = await browser.newPage();
 const errors = [], findings = [];
 page.on('pageerror', e => errors.push(e.message));
 await page.addInitScript(({user}) => { localStorage.setItem('sb-theme-qa-auth-token', JSON.stringify({ access_token: 'fixture', refresh_token: 'fixture', expires_at: Math.floor(Date.now()/1000)+360000, token_type: 'bearer', user })); localStorage.setItem('theme','dark'); }, {user});
 let dataMode='normal';
 const handleApi = async route => {
   const url = new URL(route.request().url()), table = url.pathname.split('/').pop();
   let data = ({ trades, journals, backtest_sessions: sessions, backtest_trades: backtestTrades })[table] || [];
   if(dataMode==='empty') data=[];
   if(dataMode==='error' && table==='trades') return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Fixture unavailable',code:'42501'})});
   if (Array.isArray(data)) {
     for (const key of ['id','trade_id','session_id']) { const filter = url.searchParams.get(key); if (filter?.startsWith('eq.')) data = data.filter(r => r[key] === filter.slice(3)); if (filter?.startsWith('gt.')) data = data.filter(r => r[key] > filter.slice(3)); }
     if(url.searchParams.get('order')?.startsWith('id')) data = [...data].sort((a,b)=>a.id.localeCompare(b.id));
     if (route.request().headers().accept?.includes('vnd.pgrst.object')) data = data[0] || null;
   }
   if (table === 'user') data = user;
   if (table === 'user_settings') {
     if (route.request().method() === 'PATCH') settings = {...settings, ...route.request().postDataJSON()};
     data = settings;
   }
   if (url.pathname.includes('/functions/')) data = { trade: trades[0], journal: journals[0] };
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
 };
 await page.route(`${api}/**`, handleApi);

 async function audit(label) {
   const result=await page.evaluate(()=>({
     pageOverflow:document.documentElement.scrollWidth>innerWidth,
     clipped:[...document.querySelectorAll('.bt-setups th,.bt-setups td,.bt-metric,.bt-session-card')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.textContent.slice(0,60)),
     truncated:[...document.querySelectorAll('.bt-setups tbody th')].some(e=>getComputedStyle(e).textOverflow==='ellipsis')
   }));
   expect(result.pageOverflow,label).toBe(false); expect(result.clipped,label).toEqual([]); expect(result.truncated,label).toBe(false);
   findings.push({label,...result});
 }
 try {
   for(let i=0;i<50;i++){try{if((await fetch(origin)).ok)break;}catch{} await new Promise(r=>setTimeout(r,250));}
   for(const width of [320,390,768,1024,1280,1440,1920]) {
     await page.setViewportSize({width,height:1000});
     await page.goto(origin+'/backtesting');
     await expect(page.getByText('Your sessions',{exact:true})).toBeVisible();
     await audit('sessions-'+width);
     await page.screenshot({path:path.join(out,'sessions-'+width+'.png'),fullPage:true});
     await page.goto(origin+'/backtesting/session-1');
     await expect(page.getByRole('table',{name:'Backtest trades'})).toBeVisible();
     if(width===390) await page.screenshot({path:path.join(out,'trades-mobile.png')});
     await audit('trades-'+width);
     if(width===390||width===1440) await page.screenshot({path:path.join(out,'trades-'+width+'.png'),fullPage:true});
     await page.getByRole('tab',{name:'Analytics',exact:true}).click();
     await expect(page.getByRole('region',{name:'By setup',exact:true})).toBeVisible();
     await expect(page.locator('.bt-setup-table tbody tr')).toHaveCount(10);
     await page.waitForTimeout(500);
     await audit('analytics-'+width);
     if(width<600) {
       const widths=await page.locator('.bt-setup-table tbody th').first().evaluate(e=>({name:e.getBoundingClientRect().width,row:e.parentElement.getBoundingClientRect().width}));
       expect(widths.name).toBeGreaterThan(widths.row-40);
       await page.locator('.bt-setups').evaluate(e=>e.scrollIntoView({block:'start'}));
       await page.screenshot({path:path.join(out,'setup-mobile-'+width+'.png')});
     }
     await page.screenshot({path:path.join(out,'analytics-'+width+'.png'),fullPage:true});
     await page.getByRole('combobox',{name:'Sort setups'}).selectOption('net-asc');
     await page.getByRole('button',{name:'Next setup page'}).click();
     await expect(page.getByText('11–20 of 26 setups',{exact:true})).toBeVisible();
     await page.getByRole('textbox',{name:'Search setups'}).fill('TJL 26 Confirmation');
     await expect(page.locator('.bt-setup-table tbody tr')).toHaveCount(1);
     await expect(page.getByText('1–1 of 1 setups',{exact:true})).toBeVisible();
   }
   await page.setViewportSize({width:1440,height:1000});
   await page.getByRole('tab',{name:'Trades',exact:true}).click();
   await page.getByRole('textbox',{name:'Search backtest trades'}).fill('TJL 26 Confirmation');
   await expect(page.getByText('Showing 1 of 48 trades')).toBeVisible();
   await page.getByRole('button',{name:'Edit backtest trade',exact:true}).first().click();
   await expect(page.getByRole('dialog')).toBeVisible();
   await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Download',exact:true}).click();
   await page.getByRole('menuitem',{name:'Trades',exact:true}).hover();
   const downloadPromise=page.waitForEvent('download');
   await page.getByRole('menuitem',{name:'Export CSV',exact:true}).click();
   const download=await downloadPromise;
   expect(download.suggestedFilename()).toMatch(/\.csv$/);
   expect(await download.failure()).toBeNull();
   await page.getByRole('tab',{name:'AI Report',exact:true}).click();
   await expect(page.getByRole('tabpanel')).toBeVisible();
   for(const width of [390,1440]) {
     settings.theme='light'; await page.setViewportSize({width,height:1000});
     await page.goto(origin+'/backtesting/session-1');
     await page.getByRole('tab',{name:'Analytics',exact:true}).click();
     await expect(page.locator('html')).toHaveClass(/light/);
     await audit('light-analytics-'+width);
     await page.screenshot({path:path.join(out,'light-analytics-'+width+'.png'),fullPage:true});
   }
   await page.goto(origin+'/backtesting/session-2');
   await page.getByRole('tab',{name:'Analytics',exact:true}).click();
   await expect(page.getByText('Add trades to unlock analytics.')).toBeVisible();
   expect(errors).toEqual([]);
   fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({errors,findings},null,2));
   console.log('Backtesting QA passed: '+findings.length+' responsive checks, setup controls, trade search, edit, CSV download, empty state, and AI tab.');
 } finally { await browser.close(); server.kill(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
