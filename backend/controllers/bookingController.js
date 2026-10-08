const { publicPricing, pricingInput, makeQuote, invoiceFor } = require('./paymentController');
const event = (kind, message) => ({ id: require('crypto').randomUUID(), kind, message, createdAt: new Date(), readAt: null });
const conflict = message => Object.assign(new Error(message), { httpStatus: 409 });
const TIMES = ['08:00', '10:30', '12:00', '14:00', '16:30', '18:00'];
const APPROVED = { role: 'provider', isVerified: true, isApprovedByAdmin: true, 'providerDetails.approvalStatus': 'approved' };
const idOK = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const textOK = (value, max, required = true) => typeof value === 'string' && value.trim().length <= max && (!required || value.trim().length > 0);
const dayKey = date => new Date(new Date(date).getTime() + 19800000).toISOString().slice(0, 10);
const scheduleSettings = p => ({ durationMinutes: p.providerDetails?.appointmentDurationMinutes ?? 60, bufferMinutes: p.providerDetails?.travelBufferMinutes ?? 30 });
// Half-open intervals permit adjacent appointments after the travel buffer.
const overlaps = (start, duration, buffer, b) => {
  const aStart = new Date(start).getTime(), bStart = new Date(b.startsAt).getTime();
  return aStart < bStart + ((b.durationMinutes ?? 60) + (b.bufferMinutes ?? 30)) * 60000 && bStart < aStart + (duration + buffer) * 60000;
};
function validPreference(start, mode, end, now = Date.now()) {
  if (!validSlot(start, now) || !['published', 'preferred', 'flexible'].includes(mode)) return false;
  if (mode !== 'flexible') return end == null;
  const finish = new Date(end).getTime(), begin = new Date(start).getTime();
  return typeof end === 'string' && Number.isFinite(finish) && new Date(finish).toISOString() === end && dayKey(start) === dayKey(end) && finish > begin && finish < now + 90 * 86400000 && finish - begin <= 12 * 3600000;
}
const acceptedStatus = b => b.pricing?.type === 'inspection' ? 'inspection_confirmed' : b.quote?.status === 'accepted' ? 'confirmed' : 'awaiting_quote';
function validSlot(value, now = Date.now()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(value)) return false;
  const date = new Date(value), stamp = date.getTime();
  return Number.isFinite(stamp) && date.toISOString().replace('.000Z', 'Z') === value.replace('.000Z', 'Z') && stamp > now && stamp < now + 90 * 86400000 && TIMES.includes(new Date(stamp + 19800000).toISOString().slice(11, 16));
}
function dto(b) {
  return { lastMessage: b.messages?.length ? b.messages[b.messages.length - 1] : null, id: String(b._id), reference: `FM-${new Date(b.createdAt).getUTCFullYear()}-${String(b._id).toUpperCase()}`, providerId: String(b.provider), providerName: b.providerName, customerName: b.customerName, service: b.service, startsAt: b.startsAt, scheduleMode: b.scheduleMode || "published", windowEnd: b.windowEnd, scheduleConfirmed: b.scheduleConfirmed, proposedStartsAt: b.proposedStartsAt, proposalVersion: b.proposalVersion, durationMinutes: b.durationMinutes ?? 60, bufferMinutes: b.bufferMinutes ?? 30, problem: b.problem, location: b.location, notes: b.notes, price: b.price, priceUnit: b.priceUnit, pricing: b.pricing, quote: b.quote, invoice: b.invoice, payment: b.payment, inspectionPerformed: b.inspectionPerformed, history: b.history || [], updatedAt: b.updatedAt, status: b.status, createdAt: b.createdAt };
}
function createBookingController(Booking, User) {
  const providerFields = 'name providerDetails.acceptingRequests providerDetails.category providerDetails.price providerDetails.priceUnit providerDetails.pricing providerDetails.bookingSlots providerDetails.appointmentDurationMinutes providerDetails.travelBufferMinutes providerDetails.serviceArea providerDetails.latitude providerDetails.longitude providerDetails.rating providerDetails.reviewCount';
  const approvedProvider = id => User.findOne({ _id: id, ...APPROVED }).select(providerFields).lean();
  const reservations = (id, session) => Booking.find({ provider: id, slotKey: { $exists: true } }).select('startsAt durationMinutes bufferMinutes').session(session || null).lean();
  async function reserve(providerId, start, settings, session, exclude) {
    const rows = await reservations(providerId, session);
    if (rows.some(b => String(b._id) !== String(exclude) && overlaps(start, settings.durationMinutes, settings.bufferMinutes, b))) throw conflict('This time overlaps another appointment or travel time. Choose an alternative or request a different time.');
  }
  async function lockProvider(id, session, extra = {}) {
    const result = await User.updateOne({ _id: id, ...APPROVED, ...extra }, { $inc: { 'providerDetails.availabilityRevision': 1 } }, { session });
    if (!result.matchedCount) throw conflict('Availability or pricing changed. Refresh before booking.');
  }
  const ownProvider = req => req.user.role === 'provider' && req.user.isVerified && req.user.isApprovedByAdmin && req.user.providerDetails?.approvalStatus === 'approved';
  const handle = fn => async (req, res) => { try { await fn(req, res); } catch (error) { if (error.httpStatus) return res.status(error.httpStatus).json({ message: error.message }); if (error.code === 11000) return res.status(409).json({ message: 'That appointment is no longer available. Please choose another time.' }); return res.status(503).json({ message: 'Booking service is temporarily unavailable. Please try again.' }); } };
  return {
    removeDay: handle(async (req, res) => {
      const date = req.body.date;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T00:00:00+05:30')) || dayKey(date + 'T00:00:00+05:30') !== date || date < dayKey(new Date()) || Date.parse(date + 'T00:00:00+05:30') > Date.now() + 90 * 86400000) return res.status(400).json({ message: 'Choose a valid date within the next 90 days.' });
      if (!ownProvider(req)) return res.status(403).json({ message: 'Provider verification is required.' });
      await User.db.transaction(async session => {
        await lockProvider(req.user._id, session);
        const p = await User.findById(req.user._id).select('providerDetails.bookingSlots providerDetails.appointmentDurationMinutes providerDetails.travelBufferMinutes').session(session).lean();
        const starts = (p.providerDetails.bookingSlots || []).filter(s => dayKey(s) === date && new Date(s) > new Date());
        const busy = await reservations(req.user._id, session);
        const removable = starts.filter(s => !busy.some(b => overlaps(s, scheduleSettings(p).durationMinutes, scheduleSettings(p).bufferMinutes, b)));
        await User.updateOne({ _id: req.user._id }, { $pull: { 'providerDetails.bookingSlots': { $in: removable } } }, { session });
      });
      res.json({ message: 'Open appointments removed. Existing booked jobs remain scheduled.' });
    }),
    messages: handle(async (req, res) => {
      if (!idOK(req.params.id)) return res.status(400).json({ message: 'Invalid booking.' });
      const b = await Booking.findOne({ _id: req.params.id, [req.user.role === 'provider' ? 'provider' : 'customer']: req.user._id }).select('messages').lean();
      if (!b) return res.status(404).json({ message: 'Conversation unavailable.' });
      res.json({ messages: b.messages || [] });
    }),
    sendMessage: handle(async (req, res) => {
      const { text, requestId } = req.body;
      if (!idOK(req.params.id) || !textOK(text, 2000) || typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{12,100}$/.test(requestId)) return res.status(400).json({ message: 'Enter a message of up to 2,000 characters.' });
      const owner = { _id: req.params.id, [req.user.role === 'provider' ? 'provider' : 'customer']: req.user._id };
      const b = await Booking.findOne(owner).select('messages').lean();
      if (!b) return res.status(404).json({ message: 'Conversation unavailable.' });
      const message = { id: requestId, sender: String(req.user._id), text: text.trim(), createdAt: new Date() };
      await Booking.updateOne({ ...owner, 'messages.id': { $ne: requestId } }, { $push: { messages: message } });
      const updated = await Booking.findOne(owner).select('messages').lean();
      res.json({ messages: updated.messages || [] });
    }),
    availability: handle(async (req, res) => {
      if (!idOK(req.params.providerId)) return res.status(400).json({ message: 'Invalid provider.' });
      const p = await approvedProvider(req.params.providerId);
      if (!p) return res.status(404).json({ message: 'This provider is no longer available.' });

      const now = Date.now();
      const slots = (p.providerDetails?.bookingSlots || []).filter(s => new Date(s).getTime() > now && new Date(s).getTime() < now + 90 * 86400000);
      const rows = await reservations(p._id), settings = scheduleSettings(p);
      const excluded = idOK(req.query.excludeBookingId) && await Booking.exists({ _id: req.query.excludeBookingId, provider: p._id, ...(req.user.role === 'customer' ? { customer: req.user._id } : { provider: req.user._id }) });
      res.json({ pricing: publicPricing(p.providerDetails.pricing), ...settings, timezone: 'Asia/Colombo', slots: slots.map(s => ({ startsAt: new Date(s).toISOString(), date: dayKey(s), available: (req.user.role === 'provider' || p.providerDetails.acceptingRequests !== false) && !rows.some(b => !(excluded && String(b._id) === req.query.excludeBookingId) && overlaps(s, settings.durationMinutes, settings.bufferMinutes, b)) })).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) });
    }),
    alternatives: handle(async (req, res) => {
      if (!idOK(req.params.providerId) || !validSlot(req.query.startsAt)) return res.status(400).json({ message: 'Choose a future preferred time.' });
      const p = await approvedProvider(req.params.providerId);
      if (!p) return res.status(404).json({ message: 'Provider not found.' });
      const providers = await User.find({ ...APPROVED, _id: { $ne: p._id }, 'providerDetails.category': p.providerDetails.category }).select(providerFields).sort({ name: 1, _id: 1 }).lean();
      const busy = providers.length ? await Booking.find({ provider: { $in: providers.map(row => row._id) }, slotKey: { $exists: true } }).select('provider startsAt durationMinutes bufferMinutes').lean() : [];
      const result = providers.filter(row => row.providerDetails.acceptingRequests !== false && (row.providerDetails.bookingSlots || []).some(s => new Date(s).getTime() === new Date(req.query.startsAt).getTime()) && !busy.some(b => String(b.provider) === String(row._id) && overlaps(req.query.startsAt, scheduleSettings(row).durationMinutes, scheduleSettings(row).bufferMinutes, b))).slice(0, 6).map(require('./providerController').publicProvider);
      res.json({ providers: result });
    }),
    create: handle(async (req, res) => {
      const { providerId, startsAt, problem, location, notes = '', requestId, scheduleMode = 'published', windowEnd } = req.body || {};
      if (!idOK(providerId) || !textOK(requestId, 100) || !textOK(problem, 2000) || !textOK(location, 500) || !textOK(notes, 1000, false)) return res.status(400).json({ message: 'Enter a valid provider, problem description and service location.' });
      const existing = await Booking.findOne({ customer: req.user._id, requestId });
      if (existing) return res.json({ booking: dto(existing) });
      if (!validPreference(startsAt, scheduleMode, windowEnd)) return res.status(400).json({ message: 'Choose a future time or a valid same-day window within the next 90 days.' });
      const p = await approvedProvider(providerId);
      if (p?.providerDetails.acceptingRequests === false) return res.status(409).json({ message: 'This provider paused new requests. Choose another provider or try later.' });
      if (!p) return res.status(404).json({ message: 'This provider is no longer available.' });
      if (scheduleMode === 'published' && !(p.providerDetails.bookingSlots || []).some(s => new Date(s).getTime() === new Date(startsAt).getTime())) return res.status(409).json({ message: 'This appointment was withdrawn. Choose an alternative or request your preferred time.' });
      const pricing = p.providerDetails.pricing;
      if (pricing ? req.body.pricingVersion !== pricing.version || req.body.acceptPricing !== true : req.body.pricingVersion != null || req.body.acceptQuoteRequest !== true) return res.status(409).json({ code: 'PRICING_CHANGED', message: 'Pricing changed. Review the latest price or acknowledge that a quote is required.' });
      const quote = pricing?.type === 'fixed' ? { version: 1, status: 'accepted', scope: pricing.inclusions, items: [{ description: pricing.inclusions, amountMinor: pricing.amountMinor }], totalMinor: pricing.amountMinor, acceptedAt: new Date() } : null;
      const settings = scheduleSettings(p);
      let booking;
      try { await User.db.transaction(async session => {
        await lockProvider(p._id, session, { 'providerDetails.acceptingRequests': { $ne: false }, ...(scheduleMode === 'published' ? { 'providerDetails.bookingSlots': new Date(startsAt) } : {}), ...(pricing ? { 'providerDetails.pricing.version': pricing.version } : { 'providerDetails.pricing': null }) });
        const fresh = await User.findById(p._id).select('providerDetails.appointmentDurationMinutes providerDetails.travelBufferMinutes').session(session).lean();
        if (JSON.stringify(scheduleSettings(fresh)) !== JSON.stringify(settings)) throw conflict('Scheduling settings changed. Refresh before requesting.');
        if (scheduleMode === 'published') await reserve(p._id, startsAt, settings, session);
        [booking] = await Booking.create([{ history: [{ status: 'pending', action: 'request', at: new Date() }], providerNotifications: [event('request', 'New booking request')], pricing, quote, ...settings, scheduleMode, windowEnd, scheduleConfirmed: false, customer: req.user._id, customerName: req.user.name, provider: p._id, providerName: p.name, service: p.providerDetails.category || 'Service', startsAt, problem: problem.trim(), location: location.trim(), notes: notes.trim(), price: p.providerDetails.price ?? null, priceUnit: p.providerDetails.priceUnit || 'visit', requestId, ...(scheduleMode === 'published' ? { slotKey: `${p._id}:${new Date(startsAt).toISOString()}` } : {}) }], { session });
      }); }
      catch (error) { if (error.code === 11000) { const replay = await Booking.findOne({ customer: req.user._id, requestId }); if (replay) return res.json({ booking: dto(replay) }); } throw error; }
      res.status(201).json({ booking: dto(booking) });
    }),
    list: handle(async (req, res) => {
      const query = req.user.role === 'provider' ? { provider: req.user._id } : { customer: req.user._id };
      const bookings = await Booking.find(query).sort({ startsAt: -1 }).lean();
      res.json({ bookings: bookings.map(dto) });
    }),
    update: handle(async (req, res) => {
      if (!idOK(req.params.id)) return res.status(400).json({ message: 'Invalid booking.' });
      const isProvider = req.user.role === 'provider';
      if (isProvider && !ownProvider(req)) return res.status(403).json({ message: 'Provider approval is required.' });
      const owner = isProvider ? { provider: req.user._id } : { customer: req.user._id };
      const booking = await Booking.findOne({ _id: req.params.id, ...owner });
      if (!booking) return res.status(404).json({ message: 'Booking not found.' });
      const { action, startsAt } = req.body || {};
      let nextStatus, update, reservationStart, mustPublish = false;
      const fail = message => res.status(409).json({ message });
      if (isProvider && action === 'confirm' && ['confirmed', 'awaiting_quote', 'inspection_confirmed'].includes(booking.status)) return res.json({ booking: dto(booking) });
      if (isProvider && action === 'propose_time') {
        if (!['pending', 'time_proposed'].includes(booking.status) || !validSlot(startsAt)) return fail('Choose a future alternative time for this request.');
        update = { $set: { status: 'time_proposed', proposedStartsAt: startsAt, proposalVersion: require('crypto').randomUUID() } };
      } else if (!isProvider && ['accept_time', 'decline_time'].includes(action)) {
        if (booking.status !== 'time_proposed' || req.body.proposalVersion !== booking.proposalVersion) return fail('This suggestion changed. Refresh and review the latest time.');
        if (action === 'accept_time') {
          if (!validSlot(booking.proposedStartsAt?.toISOString())) return fail('This suggested time has passed. Request another time.');
          reservationStart = booking.proposedStartsAt;
          update = { $set: { startsAt: reservationStart, scheduleMode: 'preferred', scheduleConfirmed: true, status: acceptedStatus(booking), slotKey: `${booking.provider}:${new Date(reservationStart).toISOString()}` }, $unset: { proposedStartsAt: 1, proposalVersion: 1, windowEnd: 1 } };
        } else update = { $set: { status: 'pending' }, $unset: { proposedStartsAt: 1, proposalVersion: 1 } };
      } else if (isProvider && action === 'confirm' && booking.status === 'pending') {
        reservationStart = startsAt || booking.startsAt;
        if (!validSlot(typeof reservationStart === 'string' ? reservationStart : reservationStart?.toISOString())) return fail('The appointment time has passed or is invalid. Suggest a future time.');
        const inPreference = booking.scheduleMode === 'flexible' ? new Date(reservationStart) >= booking.startsAt && new Date(reservationStart) < booking.windowEnd : new Date(reservationStart).getTime() === booking.startsAt.getTime();
        if (!inPreference) return fail('This time is outside the customer’s preference. Suggest it for customer approval instead.');
        mustPublish = booking.scheduleMode === 'published';
        update = { $set: { startsAt: reservationStart, scheduleConfirmed: true, status: acceptedStatus(booking), slotKey: `${booking.provider}:${new Date(reservationStart).toISOString()}` } };
      } else if (isProvider && action === 'quote') {
        if (['pending', 'time_proposed'].includes(booking.status)) return fail('Confirm the appointment time before sending a quote.');
        if (!['pending', 'awaiting_quote', 'confirmed', 'inspecting', 'ongoing', 'quote_pending'].includes(booking.status)) return fail('A quote cannot be sent at this stage.');
        if (booking.pricing?.type === 'inspection' && !booking.inspectionPerformed) return fail('Complete the agreed inspection before quoting for repairs.');
        let quote;
        try { quote = makeQuote(req.body, booking); } catch (error) { return res.status(400).json({ message: error.message }); }
        update = { $set: { quote, status: 'quote_pending', quoteReturnStatus: booking.status === 'quote_pending' ? booking.quoteReturnStatus : booking.status }, $push: { quoteHistory: booking.quote } };
      } else if (!isProvider && ['approve_quote', 'decline_quote'].includes(action)) {
        if (booking.status !== 'quote_pending' || booking.quote?.status !== 'pending' || req.body.quoteVersion !== booking.quote.version) return fail('This quote changed. Refresh and review the latest quote.');
        const quote = { ...booking.quote, status: action === 'approve_quote' ? 'accepted' : 'declined', respondedAt: new Date() };
        if (action === 'approve_quote') {
          update = { $set: { quote, status: booking.quoteReturnStatus === 'ongoing' ? 'ongoing' : 'confirmed' } };
        } else {
          const previous = [...booking.quoteHistory].reverse().find(q => q?.status === 'accepted');
          if (previous) update = { $set: { quote: previous, status: booking.quoteReturnStatus === 'ongoing' ? 'ongoing' : 'confirmed' }, $push: { quoteHistory: quote } };
          else if (booking.inspectionPerformed) update = { $set: { quote, status: 'completed', invoice: invoiceFor(booking, true) }, $unset: { slotKey: 1 } };
          else update = { $set: { quote, status: 'cancelled' }, $unset: { slotKey: 1 } };
        }
      } else
      if (!isProvider && action === 'reschedule' && ['pending', 'time_proposed', 'awaiting_quote', 'confirmed', 'inspection_confirmed'].includes(booking.status) && !booking.inspectionPerformed) {
        const { scheduleMode = 'published', windowEnd } = req.body;
        if (!validPreference(startsAt, scheduleMode, windowEnd)) return res.status(400).json({ message: 'Choose a valid future appointment or window.' });
        const p = await approvedProvider(booking.provider);
        if (!p || (scheduleMode === 'published' && !(p.providerDetails.bookingSlots || []).some(s => new Date(s).getTime() === new Date(startsAt).getTime()))) return res.status(409).json({ message: 'That appointment is not published. Request a preferred time instead.' });
        const { problem = booking.problem, location = booking.location, notes = booking.notes } = req.body || {};
        if (!textOK(problem, 2000) || !textOK(location, 500) || !textOK(notes, 1000, false)) return res.status(400).json({ message: 'Enter a valid problem description and service location.' });
        if (problem.trim() !== booking.problem || location.trim() !== booking.location) return fail('Rescheduling changes the appointment time only. Cancel and create a new request to change the work or address.');
        nextStatus = 'pending'; update = { $set: { startsAt, status: nextStatus, scheduleMode, scheduleConfirmed: false, problem: problem.trim(), location: location.trim(), notes: notes.trim(), ...(scheduleMode === 'flexible' ? { windowEnd } : {}) }, $unset: { proposedStartsAt: 1, proposalVersion: 1, ...(scheduleMode !== 'flexible' ? { windowEnd: 1 } : {}) } };
        if (scheduleMode === 'published') { reservationStart = startsAt; mustPublish = true; update.$set.slotKey = `${booking.provider}:${new Date(startsAt).toISOString()}`; }
        else update.$unset.slotKey = 1;
      } else {
        const transitions = isProvider
          ? { pending: { confirm: booking.pricing?.type === 'inspection' ? 'inspection_confirmed' : booking.quote?.status === 'accepted' ? 'confirmed' : 'awaiting_quote', reject: 'rejected' }, time_proposed: { reject: 'rejected' }, inspection_confirmed: { inspect: 'inspecting' }, confirmed: { start: 'ongoing' }, ongoing: { complete: 'completed' } }
          : { pending: { cancel: 'cancelled' }, time_proposed: { cancel: 'cancelled' }, awaiting_quote: { cancel: 'cancelled' }, confirmed: { cancel: 'cancelled' }, inspection_confirmed: { cancel: 'cancelled' } };
        nextStatus = transitions[booking.status]?.[action];
        if (!nextStatus || (!isProvider && booking.inspectionPerformed)) return fail('This action is not available for the current booking status.');
        if (isProvider && ['confirm', 'start', 'complete'].includes(action) && !['inspection_confirmed', 'awaiting_quote'].includes(nextStatus) && booking.quote?.status !== 'accepted') return fail('Send a quote and obtain customer approval before confirming or starting repairs.');
        update = { $set: { status: nextStatus } };
        if (action === 'inspect') update.$set.inspectionPerformed = true;
        if (action === 'complete') update.$set.invoice = invoiceFor(booking);
        if (['cancelled', 'rejected'].includes(nextStatus)) update.$unset = { slotKey: 1 };
      }

      update.$push = { ...update.$push, history: { status: update.$set.status, action, at: new Date() } };
      if (!isProvider) update.$push.providerNotifications = event(action, { approve_quote: 'Customer approved your quote', decline_quote: 'Customer declined your quote', cancel: 'Customer cancelled a booking', reschedule: 'Customer requested a new appointment time', accept_time: 'Customer accepted your suggested time', decline_time: 'Customer kept their requested time' }[action] || 'Booking updated');
      update.$inc = { __v: 1 };
      let updated;
      const write = session => Booking.findOneAndUpdate({ _id: booking._id, ...owner, status: booking.status, __v: booking.__v }, update, { returnDocument: 'after', runValidators: true, ...(session ? { session } : {}) });
      if (reservationStart || action === 'reschedule' || action === 'propose_time') await User.db.transaction(async session => {
        await lockProvider(booking.provider, session, mustPublish ? { 'providerDetails.bookingSlots': new Date(reservationStart) } : {});
        if (reservationStart) await reserve(booking.provider, reservationStart, { durationMinutes: booking.durationMinutes, bufferMinutes: booking.bufferMinutes }, session, booking._id);
        if (action === 'propose_time') await reserve(booking.provider, startsAt, { durationMinutes: booking.durationMinutes, bufferMinutes: booking.bufferMinutes }, session, booking._id);
        updated = await write(session);
      }); else updated = await write();
      if (!updated) return res.status(409).json({ message: 'This booking changed. Refresh and try again.' });
      res.json({ booking: dto(updated) });
    }),
    notifications: handle(async (req, res) => {
      const rows = await Booking.find({ provider: req.user._id }).select('providerNotifications customerName service').lean();
      const notifications = rows.flatMap(b => (b.providerNotifications || []).map(n => ({ ...n, bookingId: String(b._id), customerName: b.customerName, service: b.service }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json({ notifications });
    }),
    readNotification: handle(async (req, res) => {
      if (!idOK(req.params.id) || typeof req.params.eventId !== 'string' || req.params.eventId.length > 100) return res.status(400).json({ message: 'Invalid notification.' });
      const result = await Booking.updateOne({ _id: req.params.id, provider: req.user._id, 'providerNotifications.id': req.params.eventId }, { $set: { 'providerNotifications.$.readAt': new Date() } });
      if (!result.matchedCount) return res.status(404).json({ message: 'Notification not found.' });
      res.json({ message: 'Notification read.' });
    }),
    removeSlot: handle(async (req, res) => {
      if (!ownProvider(req)) return res.status(403).json({ message: 'Provider approval is required.' });
      const { startsAt } = req.body || {};
      if (!validSlot(startsAt)) return res.status(400).json({ message: 'Choose a valid future appointment.' });
      await User.db.transaction(async session => {
        await User.updateOne({ _id: req.user._id }, { $inc: { 'providerDetails.availabilityRevision': 1 } }, { session });
        const rows = await reservations(req.user._id, session);
        const p = await approvedProvider(req.user._id), settings = scheduleSettings(p);
        if (rows.some(b => overlaps(startsAt, settings.durationMinutes, settings.bufferMinutes, b))) throw conflict('This time overlaps a reserved booking. It cannot be removed.');
        await User.updateOne({ _id: req.user._id }, { $pull: { 'providerDetails.bookingSlots': new Date(startsAt) } }, { session });
      });
      res.json({ message: 'Appointment removed.' });
    }),
    getPricing: handle(async (req, res) => {
      const p = await approvedProvider(req.user._id);
      if (!p) return res.status(403).json({ message: 'Provider approval is required.' });
      res.json({ pricing: p.providerDetails.pricing || null });
    }),
    saveScheduleSettings: handle(async (req, res) => {
      if (!ownProvider(req)) return res.status(403).json({ message: 'Provider approval is required.' });
      const { durationMinutes, bufferMinutes } = req.body || {};
      if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 480 || !Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 120) return res.status(400).json({ message: 'Use a duration of 30–480 minutes and travel buffer of 0–120 minutes.' });
      await User.updateOne({ _id: req.user._id, ...APPROVED }, { $set: { 'providerDetails.appointmentDurationMinutes': durationMinutes, 'providerDetails.travelBufferMinutes': bufferMinutes }, $inc: { 'providerDetails.availabilityRevision': 1 } });
      res.json({ durationMinutes, bufferMinutes });
    }),
    savePricing: handle(async (req, res) => {
      if (!ownProvider(req)) return res.status(403).json({ message: 'Provider approval is required.' });
      let pricing;
      try { pricing = pricingInput(req.body || {}); } catch (error) { return res.status(400).json({ message: error.message }); }
      pricing.version = require('crypto').randomUUID();
      await User.updateOne({ _id: req.user._id, ...APPROVED }, { $set: { 'providerDetails.pricing': pricing } });
      res.json({ pricing });
    }),
    publishSlot: handle(async (req, res) => {
      if (!ownProvider(req)) return res.status(403).json({ message: 'Provider approval is required.' });
      const { startsAt } = req.body || {};
      if (!validSlot(startsAt)) return res.status(400).json({ message: 'Choose a future date and one of the supported appointment times within 90 days.' });
      await User.updateOne({ _id: req.user._id, ...APPROVED }, { $addToSet: { 'providerDetails.bookingSlots': new Date(startsAt) } });
      res.json({ message: 'Appointment published.', startsAt });
    }),
  };
}
module.exports = { event, createBookingController, validSlot, validPreference, overlaps, TIMES, dto };
