const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema({
  dateKey: {
    type: String,
    required: true, // e.g. "2026-10-05"
  },
  start: {
    type: Number,
    required: true, // minutes from midnight, e.g. 540 for 9:00 AM
  },
  end: {
    type: Number,
    required: true, // minutes from midnight, e.g. 660 for 11:00 AM
  },
  type: {
    type: String,
    enum: ["available", "booked"],
    default: "available",
  },
  title: {
    type: String,
    default: "Open for bookings",
  },
  custom: {
    type: Boolean,
    default: true,
  },
});

const availabilitySchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    workingDays: {
      0: { type: Boolean, default: false }, // Sun
      1: { type: Boolean, default: true },  // Mon
      2: { type: Boolean, default: true },  // Tue
      3: { type: Boolean, default: true },  // Wed
      4: { type: Boolean, default: true },  // Thu
      5: { type: Boolean, default: true },  // Fri
      6: { type: Boolean, default: true },  // Sat
    },
    offDates: [
      {
        type: String, // Array of date keys e.g. ["2026-10-05", "2026-10-10"]
      },
    ],
    slots: [slotSchema],
  },
  {
    timestamps: true,
  }
);

// Legacy calendar keys were sometimes saved without zero padding. Read them
// canonically without destroying the original interval records.
const canonicalDate = value => {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value || '');
  if (!match) return null;
  const key = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const date = new Date(key + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : null;
};
availabilitySchema.statics.calendarFor = async function(provider, session) {
  const row = await this.findOne({ provider }).session(session || null).lean();
  return {
    // No old calendar means no restriction; do not silently hide existing Sundays.
    workingDays: row?.workingDays || { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
    offDates: [...new Set((row?.offDates || []).map(canonicalDate).filter(Boolean))],
    unrecognizedOffDates: (row?.offDates || []).filter(value => !canonicalDate(value)),
    legacySlots: row?.slots || [],
  };
};
availabilitySchema.statics.isOpen = (calendar, start) => {
  const local = new Date(new Date(start).getTime() + 19800000);
  return calendar.workingDays[local.getUTCDay()] !== false && !calendar.offDates.includes(local.toISOString().slice(0, 10));
};
availabilitySchema.statics.canonicalDate = canonicalDate;
const Availability = mongoose.model("Availability", availabilitySchema);

module.exports = Availability;
