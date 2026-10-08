const mongoose = require('mongoose');
// Embedded in Booking so invoice/payment changes are atomic with job state.
module.exports = new mongoose.Schema({
  status: { type: String, enum: ['unpaid', 'awaiting_confirmation', 'paid'], default: 'unpaid' },
  method: { type: String, enum: ['cash', 'bank_transfer'] },
  reference: String,
  reportedAt: Date,
  paidAt: Date,
  confirmedBy: mongoose.Schema.Types.ObjectId,
  receipt: String,
}, { _id: false });
