const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  providerName: { type: String, required: true },
  customerName: { type: String, required: true },
  service: { type: String, required: true },
  startsAt: { type: Date, required: true },
  scheduleMode: { type: String, enum: ['published', 'preferred', 'flexible'], default: 'published' },
  windowEnd: Date,
  scheduleConfirmed: { type: Boolean, default: false },
  proposedStartsAt: Date,
  proposalVersion: String,
  durationMinutes: { type: Number, default: 60 },
  bufferMinutes: { type: Number, default: 30 },
  problem: { type: String, required: true, maxlength: 2000 },
  location: { type: String, required: true, maxlength: 500 },
  notes: { type: String, default: '', maxlength: 1000 },
  messages: { type: [{ id: String, sender: String, text: { type: String, maxlength: 2000 }, createdAt: Date }], default: [] },
  price: { type: Number, default: null },
  priceUnit: { type: String, default: 'visit' },
  pricing: { type: mongoose.Schema.Types.Mixed, default: null },
  quote: { type: mongoose.Schema.Types.Mixed, default: null },
  quoteHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  quoteReturnStatus: String,
  history: { type: [mongoose.Schema.Types.Mixed], default: [] },
  providerNotifications: { type: [mongoose.Schema.Types.Mixed], default: [] },
  inspectionPerformed: { type: Boolean, default: false },
  invoice: { type: mongoose.Schema.Types.Mixed, default: null },
  payment: { type: require('./Payment'), default: () => ({ status: 'unpaid' }) },
  status: { type: String, enum: ['pending', 'time_proposed', 'awaiting_quote', 'confirmed', 'inspection_confirmed', 'inspecting', 'quote_pending', 'ongoing', 'completed', 'cancelled', 'rejected'], default: 'pending' },
  // A single atomic unique key reserves a provider appointment across all customers.
  slotKey: { type: String },
  requestId: { type: String, required: true },
}, { timestamps: true });
schema.index({ slotKey: 1 }, { unique: true, sparse: true });
schema.index({ customer: 1, requestId: 1 }, { unique: true });
module.exports = mongoose.model('Booking', schema);
