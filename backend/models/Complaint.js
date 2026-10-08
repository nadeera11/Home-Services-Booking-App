const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingReference: { type: String, required: true },
  customerName: String,
  providerName: String,
  description: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['Submitted', 'Under Review', 'Resolved'], default: 'Submitted' },
  response: { type: String, maxlength: 2000, default: '' },
}, { timestamps: true });
// One case per booking: retries cannot create duplicate cases.
schema.index({ customer: 1, booking: 1 }, { unique: true });
module.exports = mongoose.model('Complaint', schema);
