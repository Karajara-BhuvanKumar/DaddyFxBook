// Browser acceptance test against fixture responses. Never reads or writes a real account.
const { chromium, expect } = require('@playwright/test');
const XLSX = require('xlsx');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.resolve(root, 'holding-time-qa');
const uid = '11111111-1111-4111-8111-111111111111', api = 'https://journal-qa.supabase.co';
const user = { id: uid, email: 'journal@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const trades = Array.from({ length: 18 }, (_, i) => ({ id: `t-${String(i).padStart(3, '0')}`, user_id: uid, symbol: i % 3 ? 'XAUUSD' : 'EURUSD', direction: i % 2 ? 'Long' : 'Short', entry_price: 4625.12345, exit_price: 4630.25, lot_size: 0.5, pnl: i % 2 ? 523 : -30.3, open_time: new Date(Date.UTC(2026, 9, 7 - i, 10)).toISOString(), close_time: new Date(Date.UTC(2026, 9, 7 - i, 11)).toISOString(), session: 'London', source: 'manual', stop_loss: 4600, take_profit: 4680, created_at: '', updated_at: '' }));
const journals = trades.filter((_, i) => i % 2 === 0).map((t, i) => ({ id: `j-${String(i).padStart(3, '0')}`, trade_id: t.id, user_id: uid, pre_trade_notes: 'Price reached the H4 demand zone. Wait for a liquidity sweep, then a clear M1 confirmation.\nRisk stays below 1%.', post_trade_notes: 'Execution was patient, with no slippage. "Plan first, trade second."', emotions: 'Calm, confident · धैर्य', lessons: 'Wait for the retest. Preserve capital before chasing profit.', tags: 'planned,London', rating: 8, risk_reward: '1:3', strategy_setup: JSON.stringify({ htf_tf: 'H4', htf_level: 'RBS', ltf_tf: 'M5', ltf_level: 'TJL 1', conf_tf: 'M1', conf_type: 'CC Engulfing', confluences: ['FIB Zone', 'Liquidity Sweep'], fib_tf: 'H1', demand_supply: 'Demand — M5', market_session: 'London', bias: 'Bullish', execution_type: 'Limit Order' }), created_at: '', updated_at: '' }));
const checklists = journals.map((j, i) => ({ id: `c-${String(i).padStart(3, '0')}`, trade_id: j.trade_id, user_id: uid, checked_higher_tf: true, risk_within_limits: true, fits_plan: true, key_levels: true, news_checked: false }));
const screenshots = [{ id: 's-1', trade_id: trades[0].id, user_id: uid, image_url: 'http://127.0.0.1:5191/fixture-chart.svg' }, { id: 's-2', trade_id: trades[0].id, user_id: uid, image_url: 'http://127.0.0.1:5191/missing-image.png' }];

async function main() {
 fs.mkdirSync(out,{recursive:true});
 const server = require('child_process').spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5197'],{cwd:root,env:{...process.env,VITE_SUPABASE_URL:api,VITE_SUPABASE_PUBLISHABLE_KEY:'journal-qa-placeholder'},stdio:'ignore',windowsHide:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const page=await browser.newPage({timezoneId:'Asia/Kolkata'}); const errors=[]; let saved=null;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';document.head.appendChild(style);}));
 await page.clock.setFixedTime(new Date('2026-10-08T00:00:00Z'));
 await page.addInitScript(({user})=>{localStorage.setItem('sb-journal-qa-auth-token',JSON.stringify({access_token:'fixture-token',refresh_token:'fixture-refresh',expires_at:2000000000,expires_in:360000,token_type:'bearer',user}));localStorage.setItem('theme','dark');},{user});
 await page.route(api+'/**',async route=>{
  const url=new URL(route.request().url()),table=url.pathname.split('/').pop();
  if(route.request().method()==='POST' && table==='trades') { saved=route.request().postDataJSON(); return route.fulfill({contentType:'application/json',body:JSON.stringify({...saved,id:'new-fixture'})}); }
  let data=({trades,journals,checklists,screenshots:[]})[table]||[];
  if(Array.isArray(data)) { for(const key of ['trade_id','id']) { const f=url.searchParams.get(key); if(f?.startsWith('eq.')) data=data.filter(r=>r[key]===f.slice(3)); if(f?.startsWith('gt.')) data=data.filter(r=>r[key]>f.slice(3)); } if(route.request().headers().accept?.includes('vnd.pgrst.object')) data=data[0]||null; }
  if(table==='user') data=user;
  if(table==='user_settings') data={user_id:uid,display_name:'QA',timezone:'Asia/Kolkata',theme:page.viewportSize().width===390?'light':'dark',currency:'USD'};
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await new Promise(r=>setTimeout(r,1800));
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(theme=>localStorage.setItem('theme',theme),width===390?'light':'dark');
  await page.goto('http://127.0.0.1:5197/trades?add=true');
  await page.getByRole('button',{name:'Open Date & Time',exact:true}).click();
  await page.locator('.trade-time-picker').screenshot({path:path.join(out,'calendar-'+width+'.png')});
  await page.locator('.trade-calendar-selected').click();
  await page.locator('.trade-time-picker').screenshot({path:path.join(out,'time-'+width+'.png')});
  await page.getByRole('spinbutton',{name:'Hour',exact:true}).fill('10');
  await page.getByRole('spinbutton',{name:'Minute',exact:true}).fill('15');
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'Close Date & Time',exact:true}).click();
  await page.locator('.trade-calendar-selected').click();
  await page.getByRole('spinbutton',{name:'Hour',exact:true}).fill('11');
  await page.getByRole('spinbutton',{name:'Minute',exact:true}).fill('40');
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.getByText('Holding duration:',{exact:false}).first()).toContainText('1h 25m');
  if(width===1440) {
   await page.getByRole('spinbutton',{name:'Entry Price',exact:true}).fill('2600');
   await page.getByRole('spinbutton',{name:'Exit Price',exact:true}).fill('2610');
   await page.getByRole('button',{name:'Save Trade',exact:true}).click();
   await expect(page.getByText('Trade added!',{exact:true})).toBeVisible();
   if(saved.open_time!=='2026-10-08T04:45:00.000Z'||saved.close_time!=='2026-10-08T06:10:00.000Z') throw Error('Incorrect saved timestamps '+JSON.stringify(saved));
   await page.getByRole('button',{name:'Edit Trade',exact:true}).first().click();
   await expect(page.getByRole('button',{name:'Open Date & Time',exact:true})).toContainText('3:30 PM');
   await page.getByRole('button',{name:'Close Date & Time',exact:true}).click();
   await page.locator('.trade-calendar-selected').click();
   await page.getByRole('button',{name:'Increase minute',exact:true}).click();
   await page.getByRole('button',{name:'Done',exact:true}).click();
   await expect(page.getByText('Holding duration:',{exact:false}).first()).toContainText('1h 1m');
   await page.getByRole('button',{name:'Cancel',exact:true}).click();
  }
  await page.screenshot({path:path.join(out,'trades-'+width+'.png')});
  await page.goto('http://127.0.0.1:5197/analysis');
  const holding=page.getByRole('region',{name:'Holding Time',exact:true});
  await expect(holding).toContainText('18 completed trades');
  await expect(holding).toContainText('18h');
  await page.evaluate(()=>document.activeElement?.blur());
  await page.mouse.move(0,0);
  await holding.screenshot({path:path.join(out,'analysis-'+width+'.png')});
  await holding.getByRole('button',{name:'Total P&L',exact:true}).click();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Overflow at '+width);
  await page.goto('http://127.0.0.1:5197/journal');
  if(width<1280) await page.getByRole('button',{name:'Open EURUSD journal',exact:true}).first().click();
  await expect(page.getByText('Close date & time',{exact:true})).toBeVisible();
  await expect(page.getByText('Oct 7, 2026, 4:30:00 PM',{exact:true})).toBeVisible();
  await page.screenshot({path:path.join(out,'journal-'+width+'.png')});
  console.log('Responsive forms, analytics, journal passed at '+width);
 }
 const result=await page.evaluate(async ({trades,journals,checklists})=>{
  const {buildJournalPDF,buildJournalWorkbook}=await import('/src/lib/exportUtils.ts');
  const {buildJournalCSV,DEFAULT_EXPORT_FIELDS}=await import('/src/lib/journalExport.ts');
  const XLSX=await import('/node_modules/.vite/deps/xlsx.js');
  const data={trades:trades.slice(0,1),journals,checklists,screenshots:[]}, options={includeFields:DEFAULT_EXPORT_FIELDS};
  const pdf=await buildJournalPDF(data,options);
  return {pdf:pdf.doc.output('datauristring').split(',')[1],csv:buildJournalCSV(data,options),xlsx:XLSX.write(buildJournalWorkbook(data,options),{type:'base64',bookType:'xlsx'})};
 },{trades,journals,checklists});
 fs.writeFileSync(path.join(out,'journal.pdf'),Buffer.from(result.pdf,'base64'));fs.writeFileSync(path.join(out,'journal.xlsx'),Buffer.from(result.xlsx,'base64'));fs.writeFileSync(path.join(out,'journal.csv'),result.csv);
 const wb=XLSX.read(Buffer.from(result.xlsx,'base64'));const row=XLSX.utils.sheet_to_json(wb.Sheets['Journal entries'])[0];
 if(row['Holding duration']!=='1h'||row['Opening time']!=='3:30:00 PM'||row['Closing time']!=='4:30:00 PM') throw Error('Export mismatch');
 if(!result.csv.includes('Holding duration')) throw Error('CSV fields missing');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('CSV and Excel values verified; PDF generated.');
 } finally { await browser.close(); server.kill(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
