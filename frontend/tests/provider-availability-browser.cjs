// Real Expo web UI with isolated API fixtures; no production data is written.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
 const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
 await context.addInitScript(() => localStorage.setItem('userToken', 'availability-fixture'));
 const day = new Date(Date.now() + 19800000 + 86400000).toISOString().slice(0,10);
 const at = time => new Date(day + 'T' + time + ':00+05:30').toISOString();
 let failRead = false, writes = 0;
 const calendar = {version:1,workingDays:{0:true,1:true,2:true,3:true,4:true,5:true,6:true},offDates:[],slots:[],bookings:[{id:'fixture-job',startsAt:at('10:30'),durationMinutes:120,bufferMinutes:30,service:'Plumbing',customerName:'Test Customer',scheduleConfirmed:false}],durationMinutes:60,bufferMinutes:30,legacySlots:[]};
 await context.route('**/api/**', async route => {
  const req=route.request(), path=new URL(req.url()).pathname.replace(/^.*\/api/,''), body=req.postDataJSON() || {};
  let data={}, status=200;
  if(path==='/auth/me') data={user:{id:'fixture-provider',name:'Fixture Provider',role:'provider',isVerified:true,providerDetails:{acceptingRequests:false,category:'Plumbing'}}};
  else if(path==='/bookings') data={bookings:[]};
  else if(path==='/bookings/notifications') data={notifications:[]};
  else if(path==='/provider/availability') {if(failRead){status=503;data={message:'Test refresh failure'};failRead=false;}else data=calendar;}
  else if(path==='/provider/availability/working-days') {calendar.workingDays=body.workingDays;calendar.version++;data=calendar;}
  else if(path==='/provider/availability/toggle-off-date') {calendar.offDates=body.isOff?[day]:[];calendar.version++;data=calendar;}
  else if(path==='/bookings/slots') {writes++;calendar.version++;calendar.slots.push({startsAt:body.startsAt,date:day,available:true});failRead=true;}
  await route.fulfill({status,json:data});
 });
 const page=await context.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.FIXMATE_AUDIT_URL || 'http://localhost:8093',{timeout:180000});
 const button=name=>page.getByRole('button',{name,exact:true});
 await page.getByRole('tab',{name:/Calendar/}).click();
 await page.getByText('New requests are paused',{exact:true}).waitFor();
 // Tomorrow may be in the next week.
 if(!await page.getByRole('button',{name:new RegExp(day+',')}).count()) await button('Next week').click();
 await page.getByRole('button',{name:new RegExp(day+',')}).click();
 await page.getByRole('textbox',{name:'Service duration in minutes'}).fill('90');
 await button('Mark date unavailable').click();await button('Resume this date').waitFor();
 assert.equal(await button('Save duration & buffer').isDisabled(),false);
 assert.equal(await page.getByRole('textbox',{name:'Service duration in minutes'}).inputValue(),'90');
 await button('Resume this date').click();await button('Mark date unavailable').waitFor();
 const weekday=new Date(day+'T00:00:00Z').getUTCDay(), name=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][weekday];
 await page.getByRole('checkbox',{name:new RegExp('^'+name)}).click();await page.getByText(/is disabled in your weekly publishing days/).waitFor();
 assert.equal(await button('Add availability').isDisabled(),true);
 await button('Mark date unavailable').click();await button('Remove date pause').waitFor();await button('Remove date pause').click();await button('Mark date unavailable').waitFor();
 assert.equal(await button('Add availability').isDisabled(),true);
 await page.getByRole('checkbox',{name:new RegExp('^'+name)}).click();await button('Add availability').click();
 assert.equal(await button('12:00 PM · Booking / travel conflict').isDisabled(),true);
 await button('2:00 PM').click();await page.getByText(/Selected: 2:00 PM/).waitFor();
 await button('Publish appointment').click();await page.getByText(/Your change was saved, but the calendar could not refresh/).first().waitFor();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(writes,1);assert.equal(await button('Add availability').isDisabled(),true);
 await button('Refresh calendar').click();await button('Add availability').click();
 assert.equal(await button('2:00 PM · Published').isDisabled(),true);await button('Close editor').click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.setViewportSize({width:320,height:740});
 await page.addStyleTag({content:'[dir="auto"] { font-size: 20px !important; }'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.screenshot({path:'.expo/availability-refined.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS weekly/date pause recovery, settings draft after unrelated changes, conflict prevention, saved-but-refresh-failed recovery, duplicate prevention, offline explanation, narrow layout');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
