const {test}=require('node:test');
const assert=require('node:assert/strict');
const User=require('../models/User'), Booking=require('../models/Booking');
const {getReportsAnalytics}=require('../controllers/adminController');
test('reports use real records, bounded buckets, period growth and real ratings',async()=>{
 const now=Date.now();let reads=0;
 const chain=rows=>({select(){return this},lean:async()=>rows});
 const bf=Booking.find,uf=User.find;
 try {
 Booking.find=()=>{reads++;return chain([{createdAt:new Date(now-86400000),status:'completed',review:{rating:4}},{createdAt:new Date(now-2*86400000),status:'cancelled'}]);};
 User.find=()=>{reads++;return chain([{createdAt:new Date(now-86400000),role:'customer'},{createdAt:new Date(now-100*86400000),role:'provider'}]);};
 const res={status(n){this.code=n;return this},json(v){this.data=v;return this}};
 await getReportsAnalytics({},res);assert.equal(res.code,200);assert.equal(reads,2);
 const d=res.data['Last 30 days'];assert.equal(d.stats.total.value,'2');assert.equal(d.stats.rating.value,'4.00');assert.equal(d.bookings.reduce((a,b)=>a+b,0),2);assert.equal(d.cancellations.reduce((a,b)=>a+b,0),1);assert.equal(d.customers.at(-1),1);assert.equal(d.providers.at(-1),0);
 Booking.find=()=>chain([]);await getReportsAnalytics({},res);assert.equal(res.data['Last 7 days'].stats.rating.value,'—');
 Booking.find=()=>{throw new Error('fixture failure')};await getReportsAnalytics({},res);assert.equal(res.code,503);
 }finally{Booking.find=bf;User.find=uf;}
});