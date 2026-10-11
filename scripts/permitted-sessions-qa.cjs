// Real application routes with isolated fixture requests; never writes account data.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.resolve(root, '../permitted-sessions-qa');
const api = 'https://discipline-qa.supabase.co', origin = 'http://127.0.0.1:5198';
const uid = '11111111-1111-4111-8111-111111111111';
const user = { id: uid, email: 'discipline@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
let trades = [1,2,3].map((n,i) => ({ id: 't'+n, user_id: uid, symbol: 'XAUUSD', direction: 'Long', entry_price: 2600, exit_price: 2610, lot_size: .1, pnl: i ? -20 : 100, risk_pct: i ? null : 1.5, open_time: '2026-10-09T20:00:00Z', close_time: '2026-10-10T01:00:00Z', session: null, source: 'manual', stop_loss: null, take_profit: null, created_at: '2026-10-10T01:00:00Z', updated_at: '2026-10-10T01:00:00Z' }));
let rules = [
  { id: 'count', rule: 'Maximum trades per day', rule_type: 'max_trades_per_day', threshold: 2 },
  { id: 'risk', rule: 'Risk per trade', rule_type: 'max_risk_per_trade', threshold: 1 },
  { id: 'sessions', rule: 'Off-session trading', rule_type: 'permitted_sessions', threshold: null, allowed_sessions: ['london'] },
].map((r,i) => ({ user_id: uid, active: true, position: i, allowed_sessions: [], ...r }));
let settings = { user_id: uid, display_name: 'Discipline QA', theme: 'dark', accent_color: 'blue', timezone: 'Asia/Kolkata', currency: 'USD' };
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = require('child_process').spawn(process.execPath, [path.join(root,'node_modules/vite/bin/vite.js'), '--host','127.0.0.1','--port','5198','--strictPort'], { cwd: root, env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture' }, stdio: 'pipe', windowsHide: true });
  let browser;
  try {
    for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break;}catch{} await new Promise(r=>setTimeout(r,250));}
    browser = await chromium.launch({ channel:'msedge', headless:true });
    const page = await browser.newPage({ viewport:{ width:1440,height:1000 } });
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    await page.addInitScript(({user}) => { localStorage.setItem('sb-discipline-qa-auth-token',JSON.stringify({access_token:'fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+360000,token_type:'bearer',user})); localStorage.setItem('theme','dark'); },{user});
    await page.route(api+'/**',async route=>{
      const req=route.request(),url=new URL(req.url()), table=url.pathname.split('/').pop();
      const filter=rows=>rows.filter(r=>[...url.searchParams].every(([key,v])=>!v.startsWith('eq.')||String(r[key])===v.slice(3))).filter(r=>!url.searchParams.get('id')?.startsWith('gt.')||r.id>url.searchParams.get('id').slice(3));
      let data=[];
      if(table==='user') data=user;
      if(table==='user_settings') data=settings;
      if(table==='trading_rules'||table==='trades') {
        let rows=table==='trades'?trades:rules;
        if(req.method()==='PATCH') { const chosen=new Set(filter(rows).map(r=>r.id)); rows=rows.map(r=>chosen.has(r.id)?{...r,...req.postDataJSON()}:r); }
        if(req.method()==='POST') rows.push({id:'added-'+rows.length,user_id:uid,active:true,...req.postDataJSON()});
        if(req.method()==='DELETE') {const chosen=new Set(filter(rows).map(r=>r.id));rows=rows.filter(r=>!chosen.has(r.id));}
        if(table==='trades') trades=rows;else rules=rows;
        data=filter(rows).sort((a,b)=>a.id.localeCompare(b.id));
      }
      if(req.headers().accept?.includes('vnd.pgrst.object')) data=Array.isArray(data)?data[0]||null:data;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });

    await page.goto(origin+'/rules');
    await page.getByRole('button',{name:'Edit rule: Off-session trading'}).click();
    const labels=['Asian · 5:30 AM – 8:00 AM IST','London · 11:00 AM – 2:30 PM IST','New York · 5:00 PM – 8:30 PM IST'];
    await expect(page.getByRole('checkbox')).toHaveCount(3);
    for(const label of labels) await expect(page.getByRole('checkbox',{name:label,exact:true})).toBeVisible();
    await page.getByRole('checkbox',{name:labels[0],exact:true}).check();
    await page.getByRole('checkbox',{name:labels[2],exact:true}).check();
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:1100});
      await page.screenshot({path:path.join(out,'rules-'+width+'.png'),fullPage:true});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    }
    await page.getByRole('button',{name:'Save Rule',exact:true}).click();
    await expect(page.getByRole('button',{name:'Save Rule',exact:true})).toHaveCount(0);
    expect(rules.find(r=>r.id==='sessions').allowed_sessions.sort()).toEqual(['asian','london','new-york']);
    await page.reload();
    await expect(page.getByText('Auto: Asian, London, New York · IST',{exact:true})).toBeVisible();
    await page.getByRole('switch',{name:'Enable rule: Off-session trading'}).click();
    await expect(page.getByRole('switch',{name:'Enable rule: Off-session trading'})).not.toBeChecked();
    await page.getByRole('switch',{name:'Enable rule: Off-session trading'}).click();
    await expect(page.getByRole('switch',{name:'Enable rule: Off-session trading'})).toBeChecked();
    await page.goto(origin+'/analysis');
    const section=page.getByRole('region',{name:'Session Performance'});
    await expect(section.locator('.an-market-row')).toHaveCount(3);
    for(const hours of ['5:30 AM – 8:00 AM IST','11:00 AM – 2:30 PM IST','5:00 PM – 8:30 PM IST']) await expect(section.locator('.an-session-grid')).toContainText(hours);
    expect(errors).toEqual([]);
    console.log('Rules browser checks passed: three exact options, save/reload, enable/disable, matching Analysis hours, no overflow at 320–1440px.');
  } finally { if(browser) await browser.close();server.kill(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
