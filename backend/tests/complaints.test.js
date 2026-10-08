const {test}=require('node:test');const assert=require('node:assert/strict');
// Isolated controller test: no database or user records are modified.
test('support cases enforce ownership, input validation, idempotent upsert and version checks',async()=>{
 const Complaint=require('../models/Complaint'),Booking=require('../models/Booking');const controller=require('../controllers/complaintController');
 const oldFind=Booking.findOne,oldUpdate=Complaint.findOneAndUpdate;
 const owner='123456789012345678901234',id='223456789012345678901234';let filters=[],written;
 Booking.findOne=async filter=>{filters.push(filter);return filter.customer===owner?{_id:id,provider:'323456789012345678901234',createdAt:'2026-10-08',customerName:'Test',providerName:'Test provider'}:null;};
 Complaint.findOneAndUpdate=async(filter,change,options)=>{filters.push(filter);if(options.upsert){written={...change.$setOnInsert,_id:'423456789012345678901234',__v:0};return written;}return filter.__v===0?{...written,...change.$set,__v:1}:null;};
 const invoke=async(fn,body,user=owner,params={})=>{let code=200,payload;await fn({body,user:{_id:user},params},{status(v){code=v;return this},json(v){payload=v}});return {code,payload};};
 try {
 assert.equal((await invoke(controller.create,{bookingId:id,description:' '})).code,400);
 assert.equal((await invoke(controller.create,{bookingId:id,description:'Missing receipt'},'other')).code,404);
 const first=await invoke(controller.create,{bookingId:id,description:'Missing receipt'});assert.equal(first.code,200);assert.equal(first.payload.complaint.bookingId,id);assert.equal(first.payload.complaint.version,0);
 const again=await invoke(controller.create,{bookingId:id,description:'Missing receipt'});assert.equal(again.payload.complaint.id,first.payload.complaint.id);
 assert.equal((await invoke(controller.update,{status:'Resolved',response:'',version:0},owner,{id})).code,400);
 assert.equal((await invoke(controller.update,{status:'Resolved',response:'Checked',version:99},owner,{id})).code,409);
 assert.equal((await invoke(controller.update,{status:'Resolved',response:'Checked',version:0},owner,{id})).code,200);
 assert.equal(filters[0].customer,'other');assert.equal(filters[1].customer,owner);
 }finally{Booking.findOne=oldFind;Complaint.findOneAndUpdate=oldUpdate;}
});
