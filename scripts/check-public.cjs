const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../frontend/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || undefined, headless:true});
 try {
 const page = await browser.newPage(); const errors=[]; const missing=[];
 page.on('pageerror', e=>errors.push(e.message)); page.on('response',r=>{if(r.status()>=400)missing.push(r.url()+' '+r.status())});
 const base=process.env.FLIGHTSENTINEL_PUBLIC_URL || 'http://localhost:8092/flightsentinel/';
 await page.goto(base, {waitUntil:'networkidle'});
 await page.getByText('RECORDED REPLAY', {exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.recharts-line-curve').length===4);
 await page.locator('.alert-banner').filter({hasText:'CONFIRMED MODEL ALERT'}).waitFor({timeout:15000});
 assert.ok(await page.getByText(/^[1-9][0-9]* events?$/, {exact:true}).count());
 await page.getByRole('button',{name:'Pause replay',exact:true}).click();
 const reading=await page.locator('.score-heading').innerText();
 await page.waitForTimeout(400); assert.equal(await page.locator('.score-heading').innerText(),reading);
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
  await page.setViewportSize({width,height}); await page.waitForTimeout(400); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`docs/public-dashboard-${name}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Show an anomaly',exact:true}).click();
 await page.getByText('RECORDED REPLAY',{exact:true}).waitFor();
 await page.getByRole('link',{name:'Project explained',exact:true}).click();
 await page.getByRole('heading',{name:'Why Isolation Forest?',exact:true}).waitFor();
 await page.locator('.page-tabs').getByRole('link',{name:'Demo & results',exact:true}).click();
 await page.getByRole('button',{name:'Pause replay',exact:true}).waitFor();
 await page.locator('.page-tabs').getByRole('link',{name:'Dashboard demo',exact:true}).click();
 await page.getByText('RECORDED REPLAY',{exact:true}).waitFor();
 assert.deepEqual(errors,[]); assert.deepEqual(missing,[]);
 console.log(JSON.stringify({url:base,charts:4,alerts:'pass',pause:'pass',restart:'pass',desktop:'pass',mobile:'pass',navigation:'pass',errors,missing},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
