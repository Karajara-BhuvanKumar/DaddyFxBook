const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
const out = '../settings-accent-qa'; fs.mkdirSync(out, { recursive:true });

const url = 'https://settings-qa.supabase.co';
const host = new URL(url).hostname;
const uid = '11111111-1111-4111-8111-111111111111';
const user = { id:uid, email:'bhuvan@example.com', aud:'authenticated', role:'authenticated', app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z' };
let settings = { user_id:uid, display_name:'Bhuvan',username:'bhuvan',avatar_url:null,timezone:'Asia/Kolkata',time_format:'24h',currency:'USD',account_size:10000,default_risk_pct:1,max_daily_risk:2.75,max_weekly_risk:6,max_trades_per_day:3,preferred_session:'London',theme:'dark',accent_color:'blue',chart_style:'smooth',compact_mode:false,notify_daily:true,notify_weekly:true,notify_monthly:false };
(async()=>{
 const server = require('child_process').spawn(process.execPath, [require('path').resolve('./node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5199'], {cwd:require('path').resolve('.'),env:{...process.env,VITE_SUPABASE_URL:url,VITE_SUPABASE_PUBLISHABLE_KEY:'settings-qa-placeholder'},stdio:'ignore',windowsHide:true});
 await new Promise(resolve=>setTimeout(resolve,1800));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage(); const errors=[]; const updates=[]; let failSave=false,failUpload=false,failPassword=false,resetCount=0,passwordCount=0,uploadCount=0,logoutCount=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url())});
 await page.addInitScript(({host,user})=>localStorage.setItem(`sb-${host.split('.')[0]}-auth-token`,JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+36000,expires_in:36000,token_type:'bearer',user})),{host,user});
 await page.route(`${url}/**`,async route=>{
  const req=route.request(), p=new URL(req.url()).pathname;
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(p.includes('/auth/v1/recover')){resetCount++;return reply({});}
  if(p.includes('/auth/v1/logout')){logoutCount++;return reply({});}
  if(p.includes('/auth/v1/user')){if(req.method()==='PUT'){passwordCount++;if(failPassword)return reply({message:'Please choose a different password'},422);}return reply(user);}
  if(p.includes('/rest/v1/user_settings')){if(req.method()==='PATCH'){if(failSave)return reply({message:'Unable to save right now',code:'42501'},403);Object.assign(settings,req.postDataJSON());updates.push(req.postDataJSON());}return reply(settings);}
  if(p.includes('/storage/v1/object/sign/'))return reply({signedURL:'/object/sign/avatars/test.png?token=test'});
  if(p.includes('/storage/v1/object/')){uploadCount++; if(failUpload)return reply({message:'Upload unavailable',statusCode:400},400);return reply({Key:'test.png'});}
  if(p.includes('/rest/v1/trades'))return reply([{id:'one',user_id:uid,symbol:'XAUUSD',pnl:200}]);
  return reply([]);
 });
 try {

 await page.setViewportSize({width:1440,height:1100});
 await page.goto('http://127.0.0.1:5199/settings');
 await page.getByRole('tab',{name:'Preferences',exact:true}).click();
 const preferences=page.getByRole('tabpanel',{name:'Preferences',exact:true});
 const save=()=>preferences.getByRole('button',{name:'Save changes',exact:true});
 const cancel=()=>preferences.getByRole('button',{name:'Cancel',exact:true});
 await expect(preferences.getByRole('group',{name:'Color swatches'}).getByRole('button')).toHaveCount(84);
 await expect(save()).toBeDisabled();
 const original=await page.locator('html').getAttribute('style');
 const rgb=hex=>'rgb('+hex.slice(1).match(/../g).map(v=>parseInt(v,16)).join(', ')+')';
 async function exactPreview(hex) {
   await expect(preferences.getByLabel('Custom color',{exact:true})).toHaveValue(hex);
   await expect(preferences.getByLabel('Open custom color picker',{exact:true})).toHaveValue(hex);
   await expect(preferences.locator('.accent-selected i')).toHaveCSS('background-color',rgb(hex));
   await expect(preferences.locator('.accent-gradient > span')).toHaveCSS('background-color',rgb(hex));
   for(const theme of ['light','dark']) {
     await expect(preferences.locator('.accent-preview-'+theme+' .accent-preview-button')).toHaveCSS('background-color',rgb(hex));
     await expect(preferences.locator('.accent-preview-'+theme+' path')).toHaveCSS('stroke',rgb(hex));
   }
 }
 // Every palette/preset renders and selects its own exact RGB value.
 for(const swatch of await preferences.locator('.accent-swatches button').all()) {
   const hex=(await swatch.getAttribute('aria-label')).match(/#[a-f0-9]{6}/)[0];
   await expect(swatch).toHaveCSS('background-color',rgb(hex));
   await swatch.click();await exactPreview(hex);await expect(swatch).toHaveAttribute('aria-pressed','true');
 }
 for(const preset of await preferences.locator('.accent-presets button').all()) {
   const dot=await preset.locator('i').evaluate(el=>getComputedStyle(el).backgroundColor);
   await preset.click();const hex=await preferences.getByLabel('Custom color',{exact:true}).inputValue();
   expect(rgb(hex)).toBe(dot);await exactPreview(hex);await expect(preset).toHaveAttribute('aria-pressed','true');
 }
 await preferences.getByLabel('Custom color',{exact:true}).fill('#ff0001');
 await exactPreview('#ff0001');
 expect(Number(await preferences.locator('#accent-hue').inputValue())).toBeCloseTo(359.764705882);
 // Known HSV endpoints and a gradient midpoint verify conversion independently.
 await preferences.locator('#accent-hue').focus();await page.keyboard.press('End');await exactPreview('#ff0000');
 await preferences.locator('#accent-saturation').focus();await page.keyboard.press('Home');await exactPreview('#ffffff');
 await preferences.locator('#accent-brightness').focus();await page.keyboard.press('Home');await exactPreview('#000000');
 await preferences.getByLabel('Custom color',{exact:true}).fill('#00ff00');
 const midpoint=await preferences.locator('.accent-gradient').boundingBox();
 await page.mouse.click(midpoint.x+midpoint.width/2,midpoint.y+midpoint.height/2);await exactPreview('#408040');
 expect(updates).toHaveLength(0);
 expect(await page.locator('html').getAttribute('style')).toBe(original);
 await cancel().click();
 await preferences.getByRole('button',{name:'Purple accent',exact:true}).click();
 await preferences.getByRole('button',{name:'Light',exact:true}).click();
 await preferences.getByRole('switch',{name:'Compact layout'}).click();
 await preferences.getByLabel('Timezone',{exact:true}).selectOption('America/New_York');
 await preferences.getByLabel('Time format',{exact:true}).selectOption('12h');
 await preferences.getByLabel('Default currency',{exact:true}).selectOption('INR');
 expect(updates).toHaveLength(0);
 expect(await page.locator('html').getAttribute('style')).toBe(original);
 await expect(preferences.getByText('You have unsaved changes',{exact:true})).toBeVisible();
 await cancel().click();
 await expect(save()).toBeDisabled();
 await expect(preferences.getByRole('button',{name:'Dark',exact:true})).toHaveAttribute('aria-pressed','true');
 await preferences.getByLabel('Custom color',{exact:true}).fill('#12abcd');
 await preferences.locator('.settings-trading summary').click();
 await preferences.getByLabel('Default risk (%)',{exact:true}).fill('1.25');
 await preferences.getByLabel('Trades per day',{exact:true}).fill('1.5');
 await preferences.locator('.settings-trading summary').click();
 await save().click();
 await expect(preferences.getByRole('alert')).toContainText('Trades per day: enter a whole number');
 expect(updates).toHaveLength(0);
 await preferences.locator('.settings-trading summary').click();
 await preferences.getByLabel('Trades per day',{exact:true}).fill('3');
 await preferences.locator('.settings-trading summary').click();
 await preferences.getByLabel('Timezone',{exact:true}).selectOption('America/New_York');
 expect(updates).toHaveLength(0);
 failSave=true;
 await save().click();
 await expect(preferences.getByRole('alert')).toContainText('Your changes are still here');
 await expect(preferences.getByLabel('Custom color',{exact:true})).toHaveValue('#12abcd');
 await expect(page.locator('html')).toHaveAttribute('data-accent','blue');
 failSave=false;
 await save().click();
 await expect(save()).toBeDisabled();
 expect(updates).toHaveLength(1);
 expect(settings.accent_color).toBe('#12abcd');
 expect(settings.timezone).toBe('America/New_York');
 expect(settings.default_risk_pct).toBe(1.25);
 expect(settings.max_daily_risk).toBe(2.75);
 await expect(page.locator('html')).toHaveAttribute('data-accent','#12abcd');
 await page.reload();
 await page.getByRole('tab',{name:'Preferences',exact:true}).click();
 await expect(preferences.getByLabel('Custom color',{exact:true})).toHaveValue('#12abcd');
 await expect(save()).toBeDisabled();
 // The color gradient and keyboard-accessible sliders edit only the draft.
 const gradient=preferences.locator('.accent-gradient');
 const box=await gradient.boundingBox();
 await page.mouse.click(box.x+box.width*.7,box.y+box.height*.25);
 const count=updates.length;
 expect(settings.accent_color).toBe('#12abcd');
 await preferences.getByLabel('Hue',{exact:false}).focus();
 await page.keyboard.press('ArrowRight');
 expect(updates.length).toBe(count);
 await expect(save()).toBeEnabled();
 await cancel().click();
 await preferences.getByLabel('Custom color',{exact:true}).fill('#invalid');
 await expect(save()).toBeEnabled();
 await save().click();
 await expect(preferences.getByRole('alert')).toContainText('Accent color: enter a valid HEX value');
 await expect(preferences.getByLabel('Custom color',{exact:true})).toHaveAttribute('aria-invalid','true');
 await cancel().click();
 for(const theme of ['dark','light']) {
   if(settings.theme!==theme){await preferences.getByRole('button',{name:theme==='light'?'Light':'Dark',exact:true}).click();await save().click();await expect(preferences.getByText('All changes saved',{exact:true})).toBeVisible();}
   for(const width of [320,390,768,1440]) {
     await page.setViewportSize({width,height:1100});
     await page.evaluate(()=>document.activeElement?.blur());
     await preferences.locator('.accent-picker').screenshot({path:out+'/picker-'+theme+'-'+width+'.png'});
     expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
     expect(await preferences.locator('.accent-picker').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(false);
   }
   for(const color of ['#000000','#ffffff','#ffff00','#ff0001','#0000ff','#12abcd']) {
     await preferences.getByLabel('Custom color',{exact:true}).fill(color);await save().click();await expect(preferences.getByText('All changes saved',{exact:true})).toBeVisible();
     expect(settings.accent_color).toBe(color);
     await exactPreview(color);
     await expect(page.locator('.app-add-trade')).toHaveCSS('background-color',rgb(color));
     await expect(page.locator('.app-nav-item.is-active > svg')).toHaveCSS('color',rgb(color));
     // Check chart tokens through browser CSS conversion, not just matching strings.
     expect(await page.evaluate(()=>{
       const el=document.createElement('span');el.style.color='hsl(var(--profit))';document.body.appendChild(el);
       const color=getComputedStyle(el).color;el.remove();return color;
     })).toBe(rgb(color));
     const contrast=await page.locator('.app-add-trade').evaluate(el=>{
       const css=getComputedStyle(el);
       const lum=value=>{const rgb=value.match(/[0-9.]+/g).slice(0,3).map(n=>{const c=Number(n)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
       const a=lum(css.color),b=lum(css.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
     });
     expect(contrast).toBeGreaterThanOrEqual(4.5);
   }
 }
 // Verify older Analysis controls also use the saved contrast-aware accent.
 await page.goto('http://127.0.0.1:5199/preview/analysis');
 await expect(page.locator('html')).toHaveAttribute('data-accent',settings.accent_color);
 const active=page.locator('.an-segments button[aria-pressed=true]').first();
 await expect(active).toBeVisible();
 const colors=await active.evaluate(el=>{
   const css=getComputedStyle(el), probe=document.createElement('span');probe.style.color='hsl(var(--primary-foreground))';document.body.appendChild(probe);const expected=getComputedStyle(probe).color;probe.remove();return {actual:css.color,expected};
 });
 expect(colors.actual).toBe(colors.expected);
 await page.goto('http://127.0.0.1:5199/settings');
 // Stage photos with no upload; all profile and preference edits share one save.
 await page.getByRole('tab',{name:'Profile',exact:true}).click();
 const profile=page.getByRole('tabpanel',{name:'Profile',exact:true});
 const photo={name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')};
 await page.locator('input[type=file]').setInputFiles(photo);
 expect(uploadCount).toBe(0);
 await profile.getByRole('button',{name:'Cancel',exact:true}).click();expect(uploadCount).toBe(0);
 await page.locator('input[type=file]').setInputFiles(photo);
 await page.getByLabel('Display name',{exact:true}).fill('Saved trader');
 await profile.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(profile.getByText('All changes saved',{exact:true})).toBeVisible();
 expect(settings.display_name).toBe('Saved trader');expect(settings.avatar_url).toBeTruthy();expect(uploadCount).toBe(1);
 await profile.getByRole('button',{name:'Remove',exact:true}).click();expect(settings.avatar_url).toBeTruthy();
 await profile.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(errors).toEqual([]);
 console.log('Settings browser checks passed: exact RGB for all 84 swatches and 4 presets, HSV controls, exact saved colors in both themes, decimal risk saves, visible validation, cancel, failure/retry, reload, staged photo, responsive layouts and button contrast.');
 } finally {await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
