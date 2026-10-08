const Complaint = require('../models/Complaint');
const Booking = require('../models/Booking');
const validId = value => /^[a-f\d]{24}$/i.test(value || '');
const dto = c => ({ id: String(c._id), version: c.__v, title: 'Booking issue', booking: c.bookingReference, bookingId: String(c.booking), customer: c.customerName, provider: c.providerName, description: c.description, status: c.status, response: c.response, priority: 'Medium', createdAt: c.createdAt });
const handle = fn => async (req, res) => { try { await fn(req, res); } catch { res.status(503).json({ message: 'Unable to load or save this case. Please try again.' }); } };
exports.list = handle(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { customer: req.user._id };
  if (req.query.bookingId) {
    if (!validId(req.query.bookingId)) return res.status(400).json({ message: 'Invalid booking.' });
    filter.booking = req.query.bookingId;
  }
  res.json({ complaints: (await Complaint.find(filter).sort({ createdAt: -1 })).map(dto) });
});
exports.create = handle(async (req, res) => {
  const { bookingId, description } = req.body || {};
  if (!validId(bookingId) || typeof description !== 'string' || !description.trim() || description.length > 2000) return res.status(400).json({ message: 'Describe the issue in up to 2,000 characters.' });
  const b = await Booking.findOne({ _id: bookingId, customer: req.user._id });
  if (!b) return res.status(404).json({ message: 'Booking not found.' });
  const filter = { booking: b._id, customer: req.user._id };
  let c;
  try {
    c = await Complaint.findOneAndUpdate(filter, { $setOnInsert: { ...filter, provider: b.provider, bookingReference: `FM-${new Date(b.createdAt).getUTCFullYear()}-${String(b._id).toUpperCase()}`, customerName: b.customerName, providerName: b.providerName, description: description.trim() } }, { upsert: true, returnDocument: 'after', runValidators: true });
  } catch (e) { if (e.code !== 11000) throw e; c = await Complaint.findOne(filter); }
  res.json({ complaint: dto(c) });
});
exports.update = handle(async (req, res) => {
  const { status, response } = req.body || {};
  if (!Number.isInteger(req.body.version) || req.body.version < 0 || !validId(req.params.id) || !['Submitted', 'Under Review', 'Resolved'].includes(status) || typeof response !== 'string' || response.length > 2000 || (status === 'Resolved' && !response.trim())) return res.status(400).json({ message: 'Choose a case status and include a response before resolving it.' });
  const c = await Complaint.findOneAndUpdate({ _id: req.params.id, __v: req.body.version }, { $set: { status, response: response.trim() }, $inc: { __v: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!c) return res.status(409).json({ message: 'This case changed. Refresh before updating it.' });
  res.json({ complaint: dto(c) });
});
