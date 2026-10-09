const { test } = require('node:test');
const assert = require('node:assert/strict');
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNuoAAAAASUVORK5CYII=';
test('provider profile persists safely and is visible to customers', {skip:process.env.RUN_PROFILE_INTEGRATION!=='1',timeout:180000}, async()=>{
 require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
 const mongoose=require('mongoose'),dbName='fixmate_profile_test_'+require('crypto').randomBytes(8).toString('hex');let server,browser;
 try{
  await mongoose.connect(process.env.MONGO_URI,{dbName,serverSelectionTimeoutMS:10000});
  const User=require('../models/User');await User.init();
  const make=(name,role,phone)=>User.create({name,email:name+'@example.test',phone,password:'Isolated-password',role,isVerified:true,isApprovedByAdmin:true,providerDetails:{category:'Plumbing',approvalStatus:'approved',bio:'Original bio',serviceArea:'Colombo',experience:'5 years'}});
  const provider=await make('ProfileProvider','provider','0700000081'),customer=await make('ProfileCustomer','customer','0700000082');
  const jwt=require('jsonwebtoken'),token=u=>jwt.sign({id:u._id,role:u.role},process.env.JWT_SECRET,{expiresIn:'10m'});
  const express=require('express'),app=express();app.use(express.json({limit:'2mb'}));app.use('/api/auth',require('../routes/authRoutes'));app.use('/api/providers',require('../routes/providerRoutes'));app.use('/api/bookings',require('../routes/bookingRoutes'));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api';
  const call=async(u,path,method='GET',body)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(u?{Authorization:'Bearer '+token(u)}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
  assert.equal((await call(null,'/auth/profile','PATCH',{name:'No'})).status,401);
  assert.equal((await call(customer,'/auth/profile','PATCH',{avatar:photo})).status,403);
  for(const avatar of ['data:image/svg+xml;base64,PHN2Zz4=', 'file:///device-only.png','data:image/png;base64,YmFk', 'x'.repeat(1400001)])assert.equal((await call(provider,'/auth/profile','PATCH',{name:'Must not save',avatar})).status,400);
  assert.equal((await call(provider,'/auth/me')).data.user.name,'ProfileProvider');
  assert.equal((await call(provider,'/auth/profile','PATCH',{phone:customer.phone})).status,409);
  assert.equal((await call(provider,'/auth/profile','PATCH',{name:' '})).status,400);
  assert.equal((await call(provider,'/auth/profile','PATCH',{phone:'-------'})).status,400);
  const saved=await call(provider,'/auth/profile','PATCH',{name:'Updated Provider',avatar:photo,role:'admin',isApprovedByAdmin:false,providerDetails:{bio:'Updated bio',serviceArea:'Kandy',experience:'6 years',rating:5,approvalStatus:'rejected'}});
  assert.equal(saved.status,200);assert.equal(saved.data.user.avatar,photo);assert.equal(saved.data.user.role,'provider');assert.equal(saved.data.user.providerDetails.approvalStatus,'approved');assert.equal(saved.data.user.providerDetails.rating,null);
  assert.equal((await User.findById(provider._id)).avatar,photo);
  const publicProfile=(await call(customer,'/providers/'+provider._id)).data.provider;
  assert.equal(publicProfile.avatar,photo);assert.equal(publicProfile.name,'Updated Provider');assert.equal(publicProfile.bio,'Updated bio');assert.equal(publicProfile.email,undefined);
  assert.equal((await call(customer,'/providers')).data.providers[0].avatar,photo);
  assert.equal((await call(provider,'/auth/me')).data.user.avatar,photo);
  const Booking=require('../models/Booking');await Booking.init();
  const booking=await Booking.create({customer:customer._id,provider:provider._id,providerName:'Old snapshot name',customerName:customer.name,service:'Plumbing',startsAt:new Date(Date.now()+86400000),problem:'Test repair',location:'Test address',requestId:'profile-test'});
  const bookingView=(await call(customer,'/bookings')).data.bookings[0];assert.equal(bookingView.providerName,'Updated Provider');assert.equal(bookingView.providerAvatar,photo);
  assert.equal((await call(customer,'/bookings/'+booking._id,'PATCH',{action:'cancel',bookingVersion:0})).data.booking.providerAvatar,photo);
  assert.equal((await Booking.findById(booking._id)).providerName,'Old snapshot name');
  if(process.env.PROFILE_BROWSER==='1'){
   await call(provider,'/auth/profile','PATCH',{avatar:''});
   const {chromium}=require(process.env.PLAYWRIGHT_PATH);browser=await chromium.launch({channel:'chrome',headless:true});
   let failSave=false;
   async function open(u){const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(t=>localStorage.setItem('userToken',t),token(u));await ctx.route('**/api/**',async route=>{const request=route.request();if(failSave&&request.method()==='PATCH'&&request.url().endsWith('/auth/profile')){failSave=false;return route.fulfill({status:503,json:{message:'Temporary upload failure. Please retry.'}});}const response=await route.fetch({url:base+request.url().split('/api')[1]});await route.fulfill({response});});const page=await ctx.newPage();await page.goto(process.env.FIXMATE_AUDIT_URL||'http://localhost:8093',{timeout:120000});return page;}
   const page=await open(provider);await page.getByRole('tab',{name:/Profile/}).click();await page.getByRole('button',{name:'Edit profile',exact:true}).click();await page.setViewportSize({width:320,height:740});
   await page.getByRole('textbox',{name:'Full name *',exact:true}).fill('');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByText('Enter your name and a valid phone number.',{exact:true}).waitFor();
   await page.getByRole('textbox',{name:'Full name *',exact:true}).fill('Browser Provider');
   const pick=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose profile photo',exact:true}).click();await (await pick).setFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});await page.getByText('Choose a JPEG or PNG photo. This file type cannot be used.',{exact:true}).waitFor();
   const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose profile photo',exact:true}).click();await (await choose).setFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from(photo.split(',')[1],'base64')});await page.getByRole('button',{name:'Remove photo',exact:true}).waitFor();assert.equal((await call(provider,'/auth/me')).data.user.avatar,'');
   failSave=true;await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByText('Temporary upload failure. Please retry.',{exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Full name *',exact:true}).inputValue(),'Browser Provider');
   await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByText('Profile saved. Your public profile has been updated.',{exact:true}).waitFor();await page.getByText('Browser Provider',{exact:true}).waitFor();assert.equal((await call(provider,'/auth/me')).data.user.avatar,photo);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:require('path').join(__dirname,'../../frontend/.expo/provider-profile-saved.png')});
   await page.reload();await page.getByRole('tab',{name:/Profile/}).click();await page.getByText('Browser Provider',{exact:true}).waitFor();
   const visitor=await open(customer);await visitor.getByRole('tab',{name:/Explore/}).click();await visitor.getByRole('button',{name:"View Browser Provider's profile",exact:true}).click();await visitor.getByRole('img',{name:'Browser Provider profile photo',exact:true}).waitFor();await visitor.screenshot({path:require('path').join(__dirname,'../../frontend/.expo/provider-profile-public.png')});
   assert.equal((await call(customer,'/providers/'+provider._id)).data.provider.name,'Browser Provider');
   await page.getByRole('button',{name:'Edit profile',exact:true}).click();await page.getByRole('button',{name:'Remove photo',exact:true}).click();await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByText('Profile saved. Your public profile has been updated.',{exact:true}).waitFor();assert.equal((await call(provider,'/auth/me')).data.user.avatar,'');
   await visitor.reload();await visitor.getByRole('tab',{name:/Explore/}).click();await visitor.getByRole('button',{name:"View Browser Provider's profile",exact:true}).click();await visitor.getByRole('button',{name:'Back to Explore',exact:true}).waitFor();assert.equal(await visitor.getByRole('img',{name:'Browser Provider profile photo',exact:true}).count(),0);

  }
  assert.equal((await call(provider,'/auth/profile','PATCH',{avatar:''})).status,200);assert.equal((await call(customer,'/providers/'+provider._id)).data.provider.avatar,'');
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));if(mongoose.connection.readyState===1&&mongoose.connection.name===dbName&&/^fixmate_profile_test_[a-f0-9]{16}$/.test(dbName))await mongoose.connection.db.dropDatabase();await mongoose.disconnect();}
});
