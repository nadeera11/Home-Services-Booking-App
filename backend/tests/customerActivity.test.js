const {test}=require('node:test');
const assert=require('node:assert/strict');
const User=require('../models/User');
const Booking=require('../models/Booking');
const c=require('../controllers/customerActivityController');
const id='123456789012345678901234';
const response=()=>({code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
test('events use actual history, ordered newest first',()=>{
 const items=c.events([{_id:id,history:[{action:'request',at:'2026-10-01'},{action:'confirm',at:'2026-10-02'}]}]);
 assert.equal(items[0].title,'Provider accepted your request');assert.equal(items[0].id,id+':1');assert.equal(items[0].bookingId,id);
});
test('saving is account scoped and idempotent',async t=>{
 t.mock.method(User,'exists',async()=>true);
 let update;t.mock.method(User,'updateOne',async(...args)=>{update=args;});
 const r=response();await c.save({user:{_id:'customer'},method:'PUT',params:{id}},r);
 assert.deepEqual(update,[{_id:'customer'},{$addToSet:{savedProviders:id}}]);assert.equal(r.body.saved,true);
});
test('cannot mark another customer booking as read',async t=>{
 let query;t.mock.method(Booking,'findOne',q=>{query=q;return {select(){return this;},async lean(){return null;}};});
 const r=response();await c.read({user:{_id:'customer'},params:{id:id+':0'}},r);
 assert.equal(query.customer,'customer');assert.equal(r.code,404);
});
test('read receipt persists for owned notification',async t=>{
 t.mock.method(Booking,'findOne',()=>({select(){return this;},async lean(){return {history:[{action:'request'}]};}}));
 let update;t.mock.method(User,'updateOne',async(...args)=>{update=args;});
 const r=response();await c.read({user:{_id:'customer'},params:{id:id+':0'}},r);
 assert.deepEqual(update,[{_id:'customer'},{$addToSet:{readCustomerEvents:id+':0'}}]);assert.equal(r.body.read,true);
});
test('reject malformed notification IDs',async()=>{
 const r=response();await c.read({user:{_id:'customer'},params:{id:id+':0:extra'}},r);assert.equal(r.code,400);
});
