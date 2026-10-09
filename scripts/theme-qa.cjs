// Exercises real routes/components against local fixtures; no account data is used.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.resolve(root, '../theme-qa');
const api = 'https://theme-qa.supabase.co', origin = 'http://127.0.0.1:5194';
const uid = '11111111-1111-4111-8111-111111111111';
const user = { id: uid, email: 'theme@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const trades = Array.from({ length: 18 }, (_, i) => ({ id: `t-${i}`, user_id: uid, symbol: i % 2 ? 'XAUUSD' : 'EURUSD', direction: i % 2 ? 'Long' : 'Short', entry_price: 4110.66, exit_price: 4120, lot_size: .1, pnl: i % 3 ? 192.3 : -30.3, open_time: new Date(Date.UTC(2026, 9, 8 - i, 10)).toISOString(), close_time: new Date(Date.UTC(2026, 9, 8 - i, 11)).toISOString(), session: 'London', source: 'manual', stop_loss: 4100, take_profit: 4140, created_at: '2026-10-08T00:00:00Z', updated_at: '2026-10-08T00:00:00Z' }));
const journals = trades.slice(0, 12).map(t => ({ id: `j-${t.id}`, trade_id: t.id, user_id: uid, pre_trade_notes: 'Wait for confirmation at the demand zone.', post_trade_notes: 'Patient execution, followed the plan.', emotions: 'Calm and focused', lessons: 'Wait for the retest.', tags: 'planned,London', rating: 8, risk_reward: '1:3', strategy_setup: JSON.stringify({market_session:'London',htf_tf:'H4',htf_level:'RBS',ltf_tf:'M5',ltf_level:'TJL 1',conf_tf:'M1',conf_type:'CC Engulfing'}), created_at: t.created_at }));
const sessions = [{ id: 'session-1', user_id: uid, name: 'London breakout', pair: 'XAUUSD', strategy: 'Breakout', description: 'Theme acceptance fixture', created_at: '2026-10-08T00:00:00Z' }];
const backtestTrades = trades.map((t,i) => ({ ...t, session_id: 'session-1', trade_number: i+1, pair: t.symbol, direction: 'long', outcome: t.pnl > 0 ? 'win' : 'loss', rr: 3, r_gained: t.pnl > 0 ? 3 : -1, trade_date: t.open_time, setup: 'Breakout', notes: 'Followed plan' }));
let settings = { user_id: uid, display_name: 'Theme QA', theme: 'light', accent_color: 'blue', timezone: 'UTC', currency: 'USD' };
async function main() {
 fs.mkdirSync(out, { recursive: true });
 const server = require('child_process').spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host','127.0.0.1','--port','5194','--strictPort'], { cwd: root, env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture' }, stdio: 'pipe', windowsHide: true });
 server.stdout.on('data', d => process.stdout.write(d)); server.stderr.on('data', d => process.stderr.write(d));
 const browser = await chromium.launch({ channel: 'msedge', headless: true }).catch(error => { server.kill(); throw error; });
 let page = await browser.newPage();
 const errors = [], findings = [];
 page.on('pageerror', e => errors.push(e.message));
 await page.addInitScript(({user}) => { localStorage.setItem('sb-theme-qa-auth-token', JSON.stringify({ access_token: 'fixture', refresh_token: 'fixture', expires_at: Math.floor(Date.now()/1000)+360000, token_type: 'bearer', user })); localStorage.setItem('theme','light'); }, {user});
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
   await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
   const result = await page.evaluate(() => {
     const canvas = document.createElement('canvas'); canvas.width=canvas.height=1;
     const ctx=canvas.getContext('2d',{willReadFrequently:true}), colors=new Map();
     const rgb = s => { if(colors.has(s))return colors.get(s); ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);const c=[...ctx.getImageData(0,0,1,1).data]; c[3]/=255;colors.set(s,c);return c; };
     const lum = c => c.slice(0,3).map(n => { n/=255; return n<=.04045 ? n/12.92 : ((n+.055)/1.055)**2.4; }).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
     function bg(el) { const layers=[];for(let e=el;e;e=e.parentElement) {const c=rgb(getComputedStyle(e).backgroundColor);layers.push(c);if(c[3]===1)break;}return layers.reverse().reduce((base,c)=>base.map((n,i)=>c[i]*c[3]+n*(1-c[3])),[255,255,255]); }
     const issues = [];
     for(const el of document.querySelectorAll('body *')) {
       if (!(el instanceof HTMLElement) || !el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}) || el.closest('svg,[aria-hidden=true]')) continue;
       const st=getComputedStyle(el), rect=el.getBoundingClientRect();
       if (!rect.width || !rect.height || st.opacity<.5 || el.matches(':disabled') || el.closest('[data-state=inactive]')) continue;
       const text = [...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim() || (el.matches('input,textarea') ? el.value : '');
       if(!text || st.backgroundImage !== 'none' || st.color.startsWith('rgba') || el.className.includes('measure')) continue;
       const a=lum(rgb(st.color)), b=lum(bg(el)); const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
       const large = parseFloat(st.fontSize)>=24 || (parseFloat(st.fontSize)>=18.66 && parseInt(st.fontWeight)>=700);
       if(ratio<(large?3:4.5)) issues.push({text:text.slice(0,65), ratio:+ratio.toFixed(2), color:st.color, bg:bg(el), cls:el.className});
     }
     return { issues, overflow: document.documentElement.scrollWidth > innerWidth };
   });
   findings.push({label,...result});
   if(result.overflow) throw Error(`Horizontal overflow: ${label}`);
   console.log(`${label}: ${result.issues.length} potential contrast issues`);
 }
 async function shot(name) { await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true}); }
 async function goto(route) {
   await page.goto(origin+route); await expect(page.locator('.app-content')).toBeVisible(); await expect(page.locator('html')).toHaveClass(/light/);
   if(route==='/analysis') await expect(page.locator('.an-kpis')).toBeVisible();
   if(route==='/ai-report') await expect(page.locator('.pc-readiness')).toBeVisible();
   await page.waitForTimeout(250);
 }
 async function toggle(name) {
   const size = page.viewportSize();
   if(size.width<640) await page.setViewportSize({...size,width:768});
   await page.getByRole('button',{name}).click();
   if(size.width<640) await page.setViewportSize(size);
 }
 try {
   for(let i=0;i<40;i++) { try {if((await fetch(origin)).ok) break;}catch{} await new Promise(r=>setTimeout(r,250)); }
   for(const width of [320,390,768,1440,1920]) {
     await page.setViewportSize({width,height:1000});
     for(const route of ['/','/trades','/journal','/rules','/analysis','/ai-report','/backtesting','/backtesting/session-1','/settings']) {
       settings.theme='light'; await goto(route);
       await audit(`${route}-${width}`);
       if(route==='/') {
         if(width<1024) {
           await page.getByRole('button',{name:'Open navigation menu'}).click();
           await expect(page.getByRole('dialog',{name:'Navigation'})).toBeVisible();
           await audit(`mobile-navigation-${width}`); await page.keyboard.press('Escape');
         }
         await page.getByRole('button',{name:'Search pages and actions',exact:true}).click();
         await expect(page.getByRole('dialog')).toBeVisible(); await audit(`search-dialog-${width}`); await page.keyboard.press('Escape');
         if(width>=768) {
           await page.getByRole('button',{name:'Notifications',exact:true}).click();
           await expect(page.locator('.app-notification-popover')).toBeVisible(); await audit(`notifications-${width}`); await page.keyboard.press('Escape');
         }
       }
       if(route==='/journal') {
         if(width<1280) await page.getByRole('button',{name:/Open .* journal/}).first().click();
         await expect(page.locator('.journal-editor textarea').first()).toHaveValue(journals[0].pre_trade_notes);
         await audit(`journal-editor-${width}`); await shot(`journal-light-${width}`);
         const before=await page.locator('.journal-editor textarea').first().inputValue();
         await toggle('Switch to dark theme');
         await expect(page.locator('html')).toHaveClass(/dark/);
         await expect(page.locator('.journal-editor')).toHaveCSS('background-color','rgb(11, 11, 11)');
         await expect(page.locator('.journal-editor textarea').first()).toHaveCSS('background-color','rgb(5, 5, 5)');
         await shot(`journal-dark-${width}`);
         await toggle('Switch to light theme');
         await expect(page.locator('.journal-editor')).toHaveCSS('background-color','rgb(255, 255, 255)');
         await expect(page.locator('.journal-editor textarea').first()).toHaveValue(before);
         await page.locator('.journal-editor').evaluate(el=>el.scrollTop=el.scrollHeight);
         await audit(`journal-strategy-${width}`); await shot(`journal-strategy-light-${width}`);
         await page.locator('.journal-editor').evaluate(el=>el.scrollTop=0);
         await page.getByRole('button',{name:'Export Journal',exact:true}).click();
         await expect(page.getByRole('dialog')).toBeVisible(); await audit(`journal-export-${width}`); await page.keyboard.press('Escape');
       }
       if(route==='/backtesting/session-1') {
         await page.getByRole('tab',{name:'Analytics',exact:true}).click();
         await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
         await page.waitForTimeout(1800);
         await audit(`backtest-charts-${width}`); await shot(`backtest-light-${width}`);
         if(width===1440) {
           const chart=page.locator('.recharts-wrapper').first(), box=await chart.boundingBox();
           await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5);
           const tooltip=page.locator('.recharts-default-tooltip').first();
           await expect(tooltip).toBeVisible(); await expect(tooltip).toHaveCSS('background-color','rgb(255, 255, 255)');
           await audit('chart-tooltip');
           await toggle('Switch to dark theme');
           await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5);
           await expect(tooltip).toHaveCSS('background-color','rgb(18, 18, 18)');
           await toggle('Switch to light theme');
         }
         await page.getByRole('tab',{name:'AI Report',exact:true}).click(); await audit(`backtest-report-${width}`);
         await page.locator('main').getByRole('button',{name:'Add trade',exact:true}).click();
         await expect(page.getByRole('dialog')).toBeVisible(); await audit(`backtest-dialog-${width}`);
         await page.getByRole('dialog').getByRole('combobox').first().click();
         await expect(page.getByRole('listbox')).toBeVisible(); await audit(`backtest-options-${width}`);
         await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
       }
       if(route==='/settings') {
         await page.getByRole('tab',{name:'Preferences'}).click(); await audit(`settings-preferences-${width}`);
         const compact=page.getByRole('switch',{name:'Compact layout'});
         await expect(compact).toHaveCSS('background-color','rgb(100, 116, 139)');
         await expect(compact.locator('span')).toHaveCSS('background-color','rgb(255, 255, 255)');
         await compact.click(); await expect(compact).toHaveAttribute('aria-checked','true');
         await expect(compact).toBeEnabled(); await compact.click(); await expect(compact).toHaveAttribute('aria-checked','false');
         await shot(`settings-light-${width}`);
       }
       if(route==='/ai-report') {
         await page.getByRole('button',{name:'Previous scorecards'}).click();
         await expect(page.getByRole('dialog').getByText('Overall', {exact:true})).toBeVisible();
         await audit(`scorecards-${width}`); await shot(`scorecards-light-${width}`); await page.keyboard.press('Escape');
         await page.getByRole('button',{name:'Connect coach',exact:true}).click(); await audit(`coach-dialog-${width}`); await page.keyboard.press('Escape');
       }
       if(route==='/analysis' || route==='/') await shot(`${route==='/analysis'?'analysis':'dashboard'}-light-${width}`);
     }
   }
   await page.setViewportSize({width:1440,height:1000}); await goto('/trades');
   await page.getByRole('button',{name:'Share Trade',exact:true}).first().click();
   await expect(page.getByRole('dialog')).toBeVisible(); await audit('share-dialog'); await shot('share-light'); await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Edit Trade',exact:true}).first().click(); await audit('edit-trade-dialog'); await page.keyboard.press('Escape');
   // Scan every authenticated route in dark mode as well.
   for(const route of ['/','/trades','/journal','/rules','/analysis','/ai-report','/backtesting','/backtesting/session-1','/settings']) {
     settings.theme='dark'; await page.goto(origin+route); await expect(page.getByRole('button',{name:'Switch to light theme'})).toBeVisible();
     await page.waitForTimeout(100); await shot(`dark-${route.replaceAll('/','-')||'dashboard'}`);
   }
   settings.theme='light'; dataMode='empty';
   for(const route of ['/','/journal','/backtesting']) { await goto(route); await page.waitForTimeout(300); await audit(`empty-${route}`); }
   dataMode='error'; await page.goto(origin+'/analysis');
   await expect(page.getByRole('button',{name:/Retry|Try again/i})).toBeVisible(); await audit('analysis-error');
   dataMode='normal';
   // Public pages have no workspace provider; verify the global palette on its own.
   const authenticatedPage=page; page=await browser.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>localStorage.setItem('theme','light'));
   await page.route(`${api}/**`,handleApi);
   for(const width of [390,1440]) {
     await page.setViewportSize({width,height:1000});
     for(const [route,ready] of [['/auth','input[type=email]'],['/reset-password','input[type=email]'],['/trade/share/t-0','header'],['/trade/share/missing','p.text-xl'],['/missing-page','h1']]) {
       await page.goto(origin+route); await expect(page.locator(ready).first()).toBeVisible(); await audit(`public-${route}-${width}`); await shot(`public-${route.replaceAll('/','-')}-${width}`);
     }
   }
   await authenticatedPage.close();
   if(errors.length) throw Error(errors.join('\n'));
   if(findings.some(f=>f.issues.length)) throw Error('Contrast review required; see theme-qa/audit.json');
   console.log('Theme switching, journal values, desktop/tablet/mobile routes and portals passed.');
 } finally {
   fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({findings,errors},null,2));
   await browser.close(); server.kill();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
