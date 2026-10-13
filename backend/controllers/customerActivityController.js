const User = require('../models/User');
const Booking = require('../models/Booking');
const { publicProvider } = require('./providerController');
const validId = id => /^[a-f0-9]{24}$/i.test(id || '');
const titles = { request:'Booking request sent', confirm:'Provider accepted your request', reject:'Booking request declined', cancel:'Booking cancelled', quote:'Quote ready for review', approve_quote:'Quote approved', decline_quote:'Quote declined', reschedule:'Reschedule requested', propose_time:'New appointment time proposed', accept_time:'Appointment time approved', start:'Work started', complete:'Service completed', inspect:'Inspection started', complete_inspection:'Inspection completed', payment_report:'Payment reported — awaiting confirmation', payment_confirm:'Payment receipt confirmed', payment_reject:'Payment report rejected' };
function events(rows) {
 return rows.flatMap(b => (b.history || []).map((h,i) => ({ id: String(b._id)+':'+i, bookingId:String(b._id), title:titles[h.action] || 'Booking updated: '+String(h.status || h.action).replaceAll('_',' '), providerName:b.providerName, service:b.service, createdAt:h.at }))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}
const wrap = fn => async(req,res) => { try { await fn(req,res); } catch { res.status(503).json({message:'Unable to load or save changes. Please try again.'}); } };
exports.bookmarks = wrap(async(req,res)=>{
 const user=await User.findById(req.user._id).select('savedProviders').lean();
 const providers=await User.find({_id:{$in:user.savedProviders || []},role:'provider',isVerified:true,isApprovedByAdmin:true,'providerDetails.approvalStatus':'approved'}).select('name avatar providerDetails').lean();
 res.json({providers:providers.map(publicProvider)});
});
exports.save = wrap(async(req,res)=>{
 if(!validId(req.params.id)) return res.status(400).json({message:'Invalid provider.'});
 if(req.method==='PUT' && !await User.exists({_id:req.params.id,role:'provider',isVerified:true,isApprovedByAdmin:true,'providerDetails.approvalStatus':'approved'})) return res.status(404).json({message:'This provider is no longer available.'});
 await User.updateOne({_id:req.user._id},req.method==='PUT'?{$addToSet:{savedProviders:req.params.id}}:{$pull:{savedProviders:req.params.id}});
 res.json({saved:req.method==='PUT'});
});
exports.notifications = wrap(async(req,res)=>{
 const [rows,user]=await Promise.all([Booking.find({customer:req.user._id}).select('history providerName service').lean(),User.findById(req.user._id).select('readCustomerEvents').lean()]);
 const read=new Set(user.readCustomerEvents || []);
 res.json({notifications:events(rows).map(e=>({...e,read:read.has(e.id)}))});
});
exports.read = wrap(async(req,res)=>{
 const [bookingId,index]=req.params.id.split(':');
 if(!/^[a-f0-9]{24}:(0|[1-9]\d*)$/i.test(req.params.id))return res.status(400).json({message:'Invalid notification.'});
 const b=await Booking.findOne({_id:bookingId,customer:req.user._id}).select('history').lean();
 if(!b?.history?.[Number(index)])return res.status(404).json({message:'This notification is no longer available.'});
 await User.updateOne({_id:req.user._id},{$addToSet:{readCustomerEvents:req.params.id}});res.json({read:true});
});
exports.events=events;
