// Real application routes with isolated fixture requests; never writes account data.
const { chromium, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.resolve(root, '../calendar-rules-qa');
const api = 'https://discipline-qa.supabase.co', origin = 'http://127.0.0.1:5197';
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
  const server = require('child_process').spawn(process.execPath, [path.join(root,'node_modules/vite/bin/vite.js'), '--host','127.0.0.1','--port','5197','--strictPort'], { cwd: root, env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture' }, stdio: 'pipe', windowsHide: true });
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
    await page.goto(origin+'/analysis');
    const day=()=>page.getByRole('button',{name:/October 10, 3 trades.*3 rule violations/});
    await expect(day()).toBeVisible();
    const findings=[];
    for(const theme of ['dark','light']) {
      settings.theme=theme;
      await page.reload();
      for(const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:1000});
        await day().click();
        await expect(page.getByRole('region',{name:'October 10, 2026 — Rule Violations'})).toBeVisible();
        const result=await day().evaluate(el=>{
          const icon=el.querySelector('.an-rule-warning').getBoundingClientRect();
          return {overflow:document.documentElement.scrollWidth>innerWidth,overlap:[...el.querySelectorAll('span,strong,small')].some(x=>{const r=x.getBoundingClientRect();return r.left<icon.right&&r.right>icon.left&&r.top<icon.bottom&&r.bottom>icon.top;})};
        });
        expect(result).toEqual({overflow:false,overlap:false});
        findings.push({theme,width,...result});
        await page.getByRole('region',{name:'Trading Calendar'}).screenshot({path:path.join(out,theme+'-'+width+'.png')});
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('link',{name:'Rules',exact:true}).click();
    await page.getByRole('button',{name:'Edit rule: Maximum trades per day'}).click();
    await page.getByRole('spinbutton',{name:'Max trades',exact:true}).fill('3');
    await page.getByRole('button',{name:'Save Rule',exact:true}).click();
    await expect(page.getByText('Auto: max 3/day')).toBeVisible();
    await page.getByRole('switch',{name:'Enable rule: Off-session trading'}).click();
    await expect(page.getByRole('switch',{name:'Enable rule: Off-session trading'})).not.toBeChecked();
    await page.getByRole('link',{name:'Analysis',exact:true}).click();
    await expect(page.getByRole('button',{name:/October 10, 3 trades.*1 rule violation$/})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button',{name:/October 10, 3 trades.*1 rule violation$/})).toBeVisible();
    // Clear the recorded risk using the real editor and verify its cache invalidation.
    await page.goto(origin+'/trades');
    const editButtons=page.getByRole('button',{name:/Edit trade/i});
    await editButtons.first().click();
    const riskInput=page.getByRole('spinbutton',{name:'Recorded risk (%)'});
    await expect(riskInput).toBeVisible();
    await riskInput.fill('');
    await page.getByRole('button',{name:/Save Changes/i}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('link',{name:'Analysis',exact:true}).click();
    await expect(page.locator('.an-rule-warning')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.an-rule-warning')).toHaveCount(0);
    // Configure an additional session rule through the complete add form.
    await page.getByRole('link',{name:'Rules',exact:true}).click();
    await page.getByRole('textbox',{name:'Rule description'}).fill('New York entries only');
    await page.getByRole('combobox').click();
    await page.getByRole('option',{name:'Permitted trading sessions',exact:true}).click();
    await page.getByRole('checkbox',{name:/New York/}).check();
    await page.getByRole('button',{name:'Add Rule',exact:true}).click();
    await expect(page.getByText('Auto: New York · IST',{exact:true})).toBeVisible();
    expect(rules.at(-1).allowed_sessions).toEqual(['new-york']);
    await page.getByRole('link',{name:'Analysis',exact:true}).click();
    await expect(page.locator('.an-rule-warning')).toHaveCount(0); // 01:30 IST is inside New York.
    // Record risk on a newly entered trade, then reload and inspect its violation.
    await page.goto(origin+'/trades?add=true');
    await page.getByRole('spinbutton',{name:'Entry Price',exact:true}).fill('2600');
    await page.getByRole('spinbutton',{name:'Exit Price',exact:true}).fill('2610');
    await page.getByRole('spinbutton',{name:'Recorded risk (%)'}).fill('2.25');
    await page.getByLabel('Open Date',{exact:true}).fill('2026-10-09T10:00');
    await page.getByLabel('Close Date',{exact:true}).fill('2026-10-09T11:00');
    await page.getByRole('button',{name:'Save Trade',exact:true}).click();
    await expect(page.getByRole('button',{name:'Save Trade',exact:true})).toHaveCount(0);
    expect(trades.at(-1).risk_pct).toBe(2.25);
    await page.getByRole('link',{name:'Analysis',exact:true}).click();
    await page.reload();
    await page.getByRole('button',{name:/October 9,.*rule violation/}).click();
    await expect(page.getByText('Recorded risk: 2.25%; maximum allowed is 1%.')).toBeVisible();
    expect(errors).toEqual([]);
    fs.writeFileSync(path.join(out,'findings.json'),JSON.stringify({findings,errors,flows:'Rule edit, disable, trade risk edit, refresh'},null,2));
    console.log('Calendar discipline browser checks passed.');
  } finally { if(browser) await browser.close();server.kill(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
