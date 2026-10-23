// Fixture-only browser QA; never connects to a real trading account.
const { chromium, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const origin = 'http://127.0.0.1:5213';
const api = 'https://journal-qa.supabase.co';
const out = process.env.CONVERTER_QA_OUT || path.join(require('os').tmpdir(), 'dfb-paste-converter-qa');
const user = { id:'11111111-1111-4111-8111-111111111111', email:'qa@example.com', aud:'authenticated', role:'authenticated', app_metadata:{provider:'email'}, user_metadata:{}, created_at:'2026-01-01T00:00:00Z' };
const trade = {id:'fixture-trade',user_id:user.id,symbol:'XAUUSD',direction:'Long',entry_price:2600,exit_price:2610,lot_size:0.1,pnl:100,open_time:'2026-10-23T12:00:00Z',close_time:'2026-10-23T13:00:00Z',source:'manual',created_at:'',updated_at:''};
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5213','--strictPort'],{cwd:root,env:{...process.env,VITE_SUPABASE_URL:api,VITE_SUPABASE_PUBLISHABLE_KEY:'journal-qa-placeholder'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let serverLog='';server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
 let browser;
 try {
  for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break;}catch{}if(i===59)throw Error('Vite unavailable: '+serverLog);await new Promise(r=>setTimeout(r,500));}
  browser=await chromium.launch({...(process.env.CONVERTER_QA_BROWSER ? {executablePath:process.env.CONVERTER_QA_BROWSER} : {channel:'msedge'}),headless:true});
  for(const timezoneId of ['UTC','America/New_York','Asia/Kolkata']){
   const context=await browser.newContext({timezoneId,permissions:['clipboard-read','clipboard-write']});
   const page=await context.newPage();const errors=[];let saves=0;
   page.on('pageerror',e=>errors.push(e.message));
   await page.clock.setFixedTime(new Date('2026-10-23T20:00:45Z'));
   await page.addInitScript(({user})=>{localStorage.setItem('sb-journal-qa-auth-token',JSON.stringify({access_token:'fixture-token',refresh_token:'fixture-refresh',expires_at:2000000000,expires_in:360000,token_type:'bearer',user}));localStorage.setItem('theme','dark');},{user});
   await page.route(api+'/**',async route=>{
    const req=route.request(),table=new URL(req.url()).pathname.split('/').pop();
    if(req.method()==='POST'&&table==='trades'){saves++;return route.fulfill({contentType:'application/json',body:JSON.stringify({...req.postDataJSON(),id:'new-fixture'})});}
    const data=table==='user'?user:table==='trades'?(new URL(req.url()).searchParams.has('id')?[]:[trade]):table==='user_settings'?{user_id:user.id,display_name:'QA',timezone:'Asia/Kolkata',theme:'dark',accent_color:'#c7ff00',currency:'USD'}:[];
    return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   });
   for(const width of timezoneId==='UTC'?[1440,1024,768,390,320]:[390]){
    await page.setViewportSize({width,height:900});
    await page.goto(origin+'/trades?add=true');
    const trigger=page.getByRole('button',{name:'UTC → IST converter',exact:true});
    const panel=page.getByRole('dialog',{name:'UTC → IST Converter'});
    const input=page.getByLabel('UTC time',{exact:true});
    const entry=page.getByRole('spinbutton',{name:'Entry Price',exact:true});
    await expect(trigger).toBeVisible();await expect(panel).toHaveCount(0);
    await entry.fill('2601');await page.getByRole('spinbutton',{name:'Exit Price',exact:true}).fill('2610');
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
    await trigger.scrollIntoViewIfNeeded();
    const before=await entry.evaluate(el=>el.getBoundingClientRect().top+scrollY);
    await trigger.click();await expect(input).toBeFocused();
    // Real clipboard paste, rather than just programmatic field fill.
    await page.evaluate(()=>navigator.clipboard.writeText('11:19:36 AM'));
    await input.press('Control+V');
    await expect(panel.locator('output')).toContainText('4:49:36 PM IST');
    await page.getByRole('button',{name:'Copy IST time',exact:true}).click();
    expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('4:49:36 PM IST');
    await page.getByRole('button',{name:'Copy date & time',exact:true}).click();
    expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('Oct 23, 2026 · 4:49:36 PM IST');
    await input.fill('23:59:59');
    await expect(panel.locator('output')).toContainText('Oct 24, 2026');
    await expect(panel.locator('output')).toContainText('5:29:59 AM IST');
    await input.fill('25:00');await expect(page.getByRole('button',{name:'Copy IST time',exact:true})).toBeDisabled();
    await input.fill('11:19:36 AM');
    async function check(stage){
     const box=await panel.boundingBox();if(box.x<0||box.x+box.width>width+1||box.y<0||box.y+box.height>901)throw Error('Panel outside viewport '+width+' '+stage);
     if(await panel.evaluate(el=>el.scrollWidth>el.clientWidth+1))throw Error('Panel overflow '+width+' '+stage);
     if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Page overflow '+width+' '+stage);
     await panel.screenshot({path:path.join(out,timezoneId.replaceAll('/','-')+'-'+width+'-'+stage+'.png')});
    }
    await check('paste');
    await page.screenshot({path:path.join(out,timezoneId.replaceAll('/','-')+'-'+width+'-page.png')});
    await page.getByRole('button',{name:'Choose UTC date',exact:true}).click();
    await check('calendar');
    await page.getByRole('gridcell',{name:'31',exact:true}).click();
    await page.getByRole('button',{name:'Toggle UTC AM/PM',exact:true}).click();
    await page.getByRole('button',{name:'Increase UTC second',exact:true}).click();
    await check('time');
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await expect(panel.locator('output')).toContainText('Nov 1, 2026');
    await expect(panel.locator('output')).toContainText('4:49:37 AM IST');
    await page.getByRole('button',{name:'Use Current UTC Time',exact:true}).click();
    await expect(input).toHaveValue('20:00:45');
    const after=await entry.evaluate(el=>el.getBoundingClientRect().top+scrollY);
    expect(Math.abs(after-before)).toBeLessThan(1);
    await input.press('Escape');await expect(panel).toHaveCount(0);await expect(trigger).toBeFocused();
    await trigger.press('Enter');await expect(input).toHaveValue('20:00:45');
    await trigger.click();await expect(panel).toHaveCount(0);
    await expect(entry).toHaveValue('2601');expect(saves).toBe(0);
    console.log('PASS '+timezoneId+' '+width+': paste, copy, calendar, seconds, rollover, Escape, draft, viewport');
   }
   await page.getByRole('button',{name:'Save Trade',exact:true}).click();
   await expect(page.getByText('Trade added!',{exact:true})).toBeVisible();expect(saves).toBe(1);
   expect(errors).toEqual([]);await context.close();
  }
  console.log('Browser QA passed. Screenshots: '+out);
 }finally{if(browser)await browser.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
