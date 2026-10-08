const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validSlot, validPreference, overlaps } = require('../controllers/bookingController');

test('appointment validation uses published time choices, future dates and a 90-day horizon', () => {
  const now = Date.parse('2026-10-06T00:00:00Z');
  assert.equal(validSlot('2026-10-07T02:30:00.000Z', now), true); // 08:00 Sri Lanka
  assert.equal(validSlot('2026-10-07T03:00:00.000Z', now), false);
  assert.equal(validSlot('2026-10-05T02:30:00.000Z', now), false);
  assert.equal(validSlot('2027-10-07T02:30:00.000Z', now), false);
  assert.equal(validSlot('2026-02-30T02:30:00.000Z', now), false);
  assert.equal(validSlot(null, now), false);
});

test('preferred windows and service/travel intervals validate boundaries and gaps', () => {
  const now = Date.parse('2026-10-06T00:00:00Z'), start = '2026-10-07T02:30:00.000Z';
  assert.equal(validPreference(start, 'preferred', null, now), true);
  assert.equal(validPreference(start, 'flexible', '2026-10-07T06:30:00.000Z', now), true);
  for (const end of [start, 'invalid', '2026-10-08T06:30:00.000Z', '2026-10-07T22:30:00.000Z']) assert.equal(validPreference(start, 'flexible', end, now), false);
  assert.equal(validPreference(start, 'fake', null, now), false);
  const booking = { startsAt: start, durationMinutes: 120, bufferMinutes: 30 };
  assert.equal(overlaps('2026-10-07T04:30:00.000Z', 60, 30, booking), true); // travel buffer
  assert.equal(overlaps('2026-10-07T05:00:00.000Z', 60, 30, booking), false); // adjacent after buffer
  assert.equal(overlaps('2026-10-07T01:30:00.000Z', 60, 30, booking), true); // earlier job's travel overlaps
  assert.equal(overlaps('2026-10-07T00:30:00.000Z', 60, 30, booking), false); // actual gap
});

test('booking lifecycle, ownership, retries and concurrent slot reservations against isolated MongoDB', { skip: process.env.RUN_BOOKING_INTEGRATION !== '1', timeout: 90000 }, async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
  const mongoose = require('mongoose');
  const dbName = 'fixmate_booking_test_' + require('crypto').randomBytes(8).toString('hex');
  let server;
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName, serverSelectionTimeoutMS: 10000 });
    const User = require('../models/User'), Booking = require('../models/Booking');
    await Promise.all([User.init(), Booking.init()]);
    const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const first = new Date(day + 'T08:00:00+05:30').toISOString();
    const second = new Date(day + 'T10:30:00+05:30').toISOString();
    const third = new Date(day + 'T12:00:00+05:30').toISOString();
    const make = (name, role, phone) => User.create({ name, email: name.toLowerCase() + '@example.test', phone, password: 'Test-only-password', role, isVerified: true, isApprovedByAdmin: true, providerDetails: role === 'provider' ? { approvalStatus: 'approved', category: 'Electrical Repair', price: 4500 } : undefined });
    const [provider, a, b, otherProvider] = await Promise.all([make('Provider', 'provider', '0700000001'), make('Alice', 'customer', '0700000002'), make('Bob', 'customer', '0700000003'), make('OtherProvider', 'provider', '0700000004')]);
    const jwt = require('jsonwebtoken');
    const tokens = new Map([provider, a, b, otherProvider].map(u => [String(u._id), jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '5m' })]));
    const express = require('express'), app = express(); app.use(express.json()); app.use('/api/auth', require('../routes/authRoutes')); app.use('/api/providers', require('../routes/providerRoutes')); app.use('/api/bookings', require('../routes/bookingRoutes')); app.use('/api/payments', require('../routes/paymentRoutes'));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/bookings`;
    const call = async (user, path = '', method = 'GET', data) => { const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: 'Bearer ' + tokens.get(String(user._id)) } : {}) }, body: data ? JSON.stringify(data) : undefined }); return { status: res.status, body: await res.json() }; };
    assert.equal((await call(null)).status, 401);
    assert.equal((await call(a, '/slots', 'POST', { startsAt: first })).status, 403);
    for (const startsAt of [first, second, third]) assert.equal((await call(provider, '/slots', 'POST', { startsAt })).status, 200);
    assert.equal((await call(a, '/slots', 'DELETE', { startsAt: first })).status, 403);
    assert.equal((await call(provider, '/slots', 'DELETE', { startsAt: first })).status, 200);
    assert.equal((await call(provider, '/slots', 'POST', { startsAt: first })).status, 200);
    const availability = await call(a, '/availability/' + provider._id);
    assert.equal(availability.body.slots.length, 3);
    assert.ok(availability.body.slots.every(s => s.available));
    assert.equal((await call(a, '/pricing', 'PATCH', { type: 'fixed', amount: 1, inclusions: 'Bad' })).status, 403);
    const settings = await call(provider, '/pricing', 'PATCH', { type: 'fixed', amount: 4500, inclusions: 'Outlet repair including labour', bankDetails: 'Test Bank / Test Account 123' });
    assert.equal(settings.status, 200);
    const payload = { acceptPricing: true, pricingVersion: settings.body.pricing.version, providerId: String(provider._id), startsAt: first, problem: 'Repair outlet', location: 'Test Street', notes: 'Test notes', requestId: 'first' };
    assert.equal((await call(a, '', 'POST', { ...payload, problem: ' ' })).status, 400);
    assert.equal((await call(provider, '', 'POST', payload)).status, 403);
    // ObjectId casing must not create two different reservation keys.
    const race = await Promise.all([call(a, '', 'POST', payload), call(b, '', 'POST', { ...payload, providerId: payload.providerId.toUpperCase(), requestId: 'second' })]);
    assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
    const winnerIndex = race.findIndex(r => r.status === 201), owner = winnerIndex === 0 ? a : b, other = winnerIndex === 0 ? b : a;
    const created = race[winnerIndex].body.booking;
    const retry = await call(owner, '', 'POST', { ...payload, requestId: winnerIndex === 0 ? 'first' : 'second' });
    assert.equal(retry.body.booking.id, created.id);
    assert.equal(await Booking.countDocuments(), 1);
    // Real booking chat is private, persistent and safe to retry concurrently.
    const chat = '/' + created.id + '/messages';
    assert.equal((await call(other, chat)).status, 404);
    assert.equal((await call(otherProvider, chat, 'POST', { text: 'Unauthorized', requestId: 'unauthorized-123' })).status, 404);
    assert.equal((await call(owner, chat, 'POST', { text: ' ', requestId: 'invalid-123456' })).status, 400);
    const chats = await Promise.all([1, 2].map(() => call(owner, chat, 'POST', { text: 'Gate is open', requestId: 'chat-request-123456' })));
    assert.ok(chats.every(r => r.status === 200));
    assert.equal((await call(provider, chat)).body.messages.length, 1);
    assert.equal((await call(provider, chat, 'POST', { text: 'On my way', requestId: 'provider-reply-1234' })).status, 200);
    assert.equal((await call(owner, chat)).body.messages.length, 2);
    assert.equal((await call(other)).body.bookings.length, 0);
    assert.equal((await call(owner)).body.bookings[0].lastMessage.text, 'On my way');
    const profile = async (u, data) => { const r = await fetch(base.replace('/bookings', '/auth/profile'), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens.get(String(u._id)) }, body: JSON.stringify(data) }); return { status: r.status, body: await r.json() }; };
    assert.equal((await profile(owner, { location: { address: 'Street', city: '', latitude: 91, longitude: 79 } })).status, 400);
    const saved = await profile(owner, { name: 'Customer Updated', role: 'admin', isVerified: false, location: { address: 'Saved Street', city: 'Colombo', latitude: 6.9, longitude: 79.8 } });
    assert.equal(saved.status, 200); assert.equal(saved.body.user.role, 'customer'); assert.equal(saved.body.user.location.city, 'Colombo'); assert.equal(saved.body.user.password, undefined);
    assert.equal((await profile(provider, { acceptingRequests: false })).status, 200);
    const paused = await call(other, '', 'POST', { ...payload, startsAt: third, requestId: 'paused' });
    assert.equal(paused.status, 409); assert.match(paused.body.message, /paused/);
    assert.ok((await call(owner, '/availability/' + provider._id)).body.slots.every(slot => !slot.available));
    assert.equal((await profile(provider, { acceptingRequests: true, providerDetails: { bio: 'Home repairs', serviceArea: 'Colombo', experience: '5 years', rating: 5, approvalStatus: 'rejected' } })).status, 200);
    const updatedProvider = await User.findById(provider._id); assert.equal(updatedProvider.providerDetails.approvalStatus, 'approved'); assert.equal(updatedProvider.providerDetails.rating, null);
    assert.equal((await call(owner, '/slots/day', 'DELETE', { date: day })).status, 403);
    assert.equal((await call(provider, '/slots/day', 'DELETE', { date: day })).status, 200);
    const dayRemaining = (await call(provider, '/availability/' + provider._id)).body.slots;
    assert.equal(dayRemaining.length, 1); assert.equal(dayRemaining[0].startsAt, first); assert.equal(dayRemaining[0].available, false);
    for (const startsAt of [second, third]) assert.equal((await call(provider, '/slots', 'POST', { startsAt })).status, 200);

    assert.equal((await call(provider, '/slots', 'DELETE', { startsAt: first })).status, 409);
    const alerts = (await call(provider, '/notifications')).body.notifications;
    assert.equal(alerts.length, 1); assert.equal(alerts[0].readAt, null);
    assert.equal((await call(a, '/notifications')).status, 403);
    assert.equal((await call(otherProvider, '/notifications')).body.notifications.length, 0);
    const readPath = '/' + created.id + '/notifications/' + alerts[0].id + '/read';
    assert.equal((await call(otherProvider, readPath, 'PATCH')).status, 404);
    assert.equal((await call(otherProvider, '/' + created.id, 'PATCH', { action: 'confirm' })).status, 404);
    assert.equal((await call(provider, readPath, 'PATCH')).status, 200);
    assert.ok((await call(provider, '/notifications')).body.notifications[0].readAt);
    assert.equal(created.history[0].status, 'pending');
    assert.equal(created.price, 4500); assert.equal(created.status, 'pending');
    assert.equal((await call(other, '/' + created.id, 'PATCH', { action: 'cancel' })).status, 404);
    assert.equal((await call(owner, '/' + created.id, 'PATCH', { action: 'confirm' })).status, 409);
    assert.equal((await call(provider, '/' + created.id, 'PATCH', { action: 'confirm' })).body.booking.status, 'confirmed');
    const occupied = await call(other, '', 'POST', { ...payload, startsAt: second, requestId: 'occupied' });
    assert.equal(occupied.status, 201);
    assert.equal((await call(owner, '/' + created.id, 'PATCH', { action: 'reschedule', startsAt: second })).status, 409);
    assert.equal((await Booking.findById(created.id)).startsAt.toISOString(), first);
    assert.equal((await call(owner, '/' + created.id, 'PATCH', { action: 'reschedule', startsAt: third, problem: 'Different scope' })).status, 409);
    const moved = await call(owner, '/' + created.id, 'PATCH', { action: 'reschedule', startsAt: third, notes: 'New notes' });
    assert.equal(moved.body.booking.status, 'pending'); assert.equal(moved.body.booking.location, 'Test Street');
    assert.equal((await call(owner)).body.bookings.length, 1);
    assert.equal((await call(provider)).body.bookings.length, 2);
    assert.equal((await call(other, '/' + occupied.body.booking.id, 'PATCH', { action: 'cancel' })).body.booking.status, 'cancelled');
    const availableAfterCancel = (await call(a, '/availability/' + provider._id)).body.slots;
    assert.equal(availableAfterCancel.find(s => s.startsAt === second).available, true);
    await call(provider, '/' + created.id, 'PATCH', { action: 'confirm' });
    assert.equal((await call(provider, '/' + created.id, 'PATCH', { action: 'start' })).body.booking.status, 'ongoing');
    assert.equal((await call(provider, '/' + created.id, 'PATCH', { action: 'complete' })).body.booking.status, 'completed');
    assert.equal((await call(owner, '/' + created.id, 'PATCH', { action: 'cancel' })).status, 409);

    const pay = async (user, id, data) => {
      const response = await fetch(base.replace('/bookings', '/payments/') + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens.get(String(user._id)) }, body: JSON.stringify(data) });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await pay(other, created.id, { action: 'report', method: 'cash' })).status, 404);
    assert.equal((await pay(owner, created.id, { action: 'confirm' })).status, 409);
    assert.equal((await pay(provider, created.id, { action: 'confirm' })).status, 409);
    assert.equal((await pay(owner, created.id, { action: 'report', method: 'bank_transfer' })).status, 400);
    const reported = await pay(owner, created.id, { action: 'report', method: 'bank_transfer', reference: 'TEST-001', totalMinor: 1 });
    assert.equal(reported.status, 200); assert.equal(reported.body.booking.invoice.totalMinor, 450000);
    assert.equal((await pay(provider, created.id, { action: 'confirm', reportedAt: 'old' })).status, 409);
    const paid = await pay(provider, created.id, { action: 'confirm', reportedAt: reported.body.booking.payment.reportedAt });
    assert.equal(paid.body.booking.payment.status, 'paid'); assert.ok(paid.body.booking.payment.receipt);
    assert.equal((await pay(owner, created.id, { action: 'report', method: 'cash' })).body.booking.payment.method, 'bank_transfer');

    // Estimates cannot bypass quote acceptance, and client totals never set an invoice.
    const estimate = await call(provider, '/pricing', 'PATCH', { type: 'estimate', min: 1000, max: 5000, inclusions: 'Labour estimate; quote required' });
    assert.equal((await call(a, '', 'POST', { ...payload, requestId: 'stale' })).status, 409);
    const est = await call(a, '', 'POST', { ...payload, requestId: 'estimate', pricingVersion: estimate.body.pricing.version });
    assert.equal(est.status, 201); const eid = est.body.booking.id;
    assert.equal((await call(provider, '/' + eid, 'PATCH', { action: 'confirm' })).body.booking.status, 'awaiting_quote');
    assert.equal((await call(provider, '/' + eid, 'PATCH', { action: 'confirm' })).body.booking.status, 'awaiting_quote');
    assert.equal((await call(provider, '/' + eid, 'PATCH', { action: 'start' })).status, 409);
    assert.equal((await pay(a, eid, { action: 'report', method: 'cash' })).status, 409);
    const quoteInput = { action: 'quote', scope: 'Replace outlet, labour and materials', items: [{ description: 'Labour', amount: 2000.25 }, { description: 'Parts', amount: 500.10 }], totalMinor: 1 };
    assert.equal((await call(a, '/' + eid, 'PATCH', quoteInput)).status, 409);
    assert.equal((await call(provider, '/' + eid, 'PATCH', { ...quoteInput, items: [{ description: 'Invalid', amount: -1 }] })).status, 400);
    const quoted = await call(provider, '/' + eid, 'PATCH', quoteInput);
    assert.equal(quoted.body.booking.quote.totalMinor, 250035);
    assert.equal((await call(provider, '/' + eid, 'PATCH', { action: 'start' })).status, 409);
    assert.equal((await call(a, '/' + eid, 'PATCH', { action: 'approve_quote', quoteVersion: 999 })).status, 409);
    assert.equal((await call(b, '/' + eid, 'PATCH', { action: 'approve_quote', quoteVersion: 1 })).status, 404);
    const decision = await Promise.all(['approve_quote', 'decline_quote'].map(action => call(a, '/' + eid, 'PATCH', { action, quoteVersion: 1 })));
    assert.deepEqual(decision.map(r => r.status).sort(), [200, 409]);
    // Start a deterministic second estimate after exercising the decision race.
    if (decision.find(r => r.status === 200).body.booking.status !== 'cancelled') await call(a, '/' + eid, 'PATCH', { action: 'cancel' });
    const finalEst = await call(a, '', 'POST', { ...payload, requestId: 'estimate-final', pricingVersion: estimate.body.pricing.version });
    const fid = finalEst.body.booking.id;
    await call(provider, '/' + fid, 'PATCH', { action: 'confirm' });
    await call(provider, '/' + fid, 'PATCH', quoteInput);
    await call(a, '/' + fid, 'PATCH', { action: 'approve_quote', quoteVersion: 1 });
    await call(provider, '/' + fid, 'PATCH', { action: 'start' });
    await call(provider, '/' + fid, 'PATCH', { ...quoteInput, items: [{ description: 'Replacement total', amount: 4000 }] });
    assert.equal((await call(provider, '/' + fid, 'PATCH', { action: 'complete' })).status, 409);
    const declined = await call(a, '/' + fid, 'PATCH', { action: 'decline_quote', quoteVersion: 2 });
    assert.equal(declined.body.booking.status, 'ongoing'); assert.equal(declined.body.booking.quote.totalMinor, 250035);
    const done = await call(provider, '/' + fid, 'PATCH', { action: 'complete', totalMinor: 1 });
    assert.equal(done.body.booking.invoice.totalMinor, 250035);
    const cash = await pay(a, fid, { action: 'report', method: 'cash' });
    assert.equal(cash.body.booking.payment.status, 'awaiting_confirmation');
    assert.equal((await pay(provider, fid, { action: 'reject', reportedAt: cash.body.booking.payment.reportedAt })).body.booking.payment.status, 'unpaid');

    // The inspection is separate from repair consent; declining repairs bills only its disclosed fee.
    const inspection = await call(provider, '/pricing', 'PATCH', { type: 'inspection', inspectionFee: 750, inclusions: 'Diagnosis only, not repairs' });
    const inspected = await call(b, '', 'POST', { ...payload, startsAt: second, requestId: 'inspection', pricingVersion: inspection.body.pricing.version });
    assert.equal(inspected.status, 201); const iid = inspected.body.booking.id;
    assert.equal((await call(provider, '/' + iid, 'PATCH', { action: 'confirm' })).body.booking.status, 'inspection_confirmed');
    assert.equal((await call(provider, '/' + iid, 'PATCH', quoteInput)).status, 409);
    assert.equal((await call(provider, '/' + iid, 'PATCH', { action: 'inspect' })).body.booking.status, 'inspecting');
    assert.equal((await call(b, '/' + iid, 'PATCH', { action: 'cancel' })).status, 409);
    const repairQuote = await call(provider, '/' + iid, 'PATCH', quoteInput);
    assert.equal(repairQuote.body.booking.quote.totalMinor, 325035);
    const repairDeclined = await call(b, '/' + iid, 'PATCH', { action: 'decline_quote', quoteVersion: 1 });
    assert.equal(repairDeclined.body.booking.status, 'completed'); assert.equal(repairDeclined.body.booking.invoice.totalMinor, 75000);
    assert.equal(repairDeclined.body.booking.invoice.inspectionOnly, true);
    assert.equal((await call(provider, '/' + iid, 'PATCH', quoteInput)).status, 409);

    const allAlerts = (await call(provider, '/notifications')).body.notifications;
    for (const kind of ['request', 'reschedule', 'cancel', 'approve_quote', 'decline_quote', 'payment']) assert.ok(allAlerts.some(n => n.kind === kind), 'Missing notification: ' + kind);
    // A slot withdrawal racing a new request must never leave a booking for an unpublished time.
    const raceSlot = new Date(day + 'T14:00:00+05:30').toISOString();
    await call(provider, '/slots', 'POST', { startsAt: raceSlot });
    const slotRace = await Promise.all([
      call(a, '', 'POST', { ...payload, startsAt: raceSlot, requestId: 'withdraw-race', pricingVersion: inspection.body.pricing.version }),
      call(provider, '/slots', 'DELETE', { startsAt: raceSlot }),
    ]);
    assert.ok((slotRace[0].status === 201 && slotRace[1].status === 409) || (slotRace[0].status === 409 && slotRace[1].status === 200), JSON.stringify(slotRace));
    const remaining = (await call(a, '/availability/' + provider._id)).body.slots.find(s => s.startsAt === raceSlot);
    if (slotRace[0].status === 201) assert.equal(remaining.available, false); else assert.equal(remaining, undefined);
    const overdue = await call(b, '', 'POST', { ...payload, startsAt: second, requestId: 'overdue-test', pricingVersion: inspection.body.pricing.version });
    assert.equal(overdue.status, 201);
    await Booking.updateOne({ _id: overdue.body.booking.id }, { $set: { startsAt: new Date(Date.now() - 86400000) } }); // isolated test fixture
    assert.equal((await call(provider, '/' + overdue.body.booking.id, 'PATCH', { action: 'confirm' })).status, 409);

    // A provider without a schedule or pricing can receive requests, never invented reservations.
    const request = { providerId: String(otherProvider._id), startsAt: first, scheduleMode: 'preferred', acceptQuoteRequest: true, problem: 'Inspect wiring', location: 'Test Street', requestId: 'preferred-a' };
    const noSchedule = await call(a, '/availability/' + otherProvider._id);
    assert.deepEqual(noSchedule.body.slots, []); assert.equal(noSchedule.body.pricing, null);
    assert.equal((await call(a, '', 'POST', { ...request, acceptQuoteRequest: false })).status, 409);
    const requests = await Promise.all([call(a, '', 'POST', request), call(b, '', 'POST', { ...request, requestId: 'preferred-b' })]);
    assert.deepEqual(requests.map(r => r.status), [201, 201]);
    for (const r of requests) assert.equal((await Booking.findById(r.body.booking.id)).slotKey, undefined);
    assert.equal((await call(otherProvider, '/' + requests[0].body.booking.id, 'PATCH', quoteInput)).status, 409);
    const confirmations = await Promise.all(requests.map(r => call(otherProvider, '/' + r.body.booking.id, 'PATCH', { action: 'confirm' })));
    assert.deepEqual(confirmations.map(r => r.status).sort(), [200, 409]);
    const confirmedIndex = confirmations.findIndex(r => r.status === 200), confirmedId = requests[confirmedIndex].body.booking.id;
    assert.equal(confirmations[confirmedIndex].body.booking.status, 'awaiting_quote');
    assert.equal(confirmations[confirmedIndex].body.booking.scheduleConfirmed, true);
    await call(confirmedIndex === 0 ? a : b, '/' + confirmedId, 'PATCH', { action: 'cancel' });
    await call(confirmedIndex === 0 ? b : a, '/' + requests[1 - confirmedIndex].body.booking.id, 'PATCH', { action: 'cancel' });

    // Flexible requests permit starts inside the window; alternatives require explicit customer consent.
    const windowEnd = new Date(day + 'T12:00:00+05:30').toISOString();
    const flex = await call(a, '', 'POST', { ...request, scheduleMode: 'flexible', windowEnd, requestId: 'flex' });
    assert.equal(flex.status, 201); const flexId = flex.body.booking.id;
    assert.equal((await call(otherProvider, '/' + flexId, 'PATCH', { action: 'confirm', startsAt: third })).status, 409);
    const proposed = await call(otherProvider, '/' + flexId, 'PATCH', { action: 'propose_time', startsAt: third });
    assert.equal(proposed.status, 200); assert.equal(proposed.body.booking.status, 'time_proposed');
    assert.equal((await call(b, '/' + flexId, 'PATCH', { action: 'accept_time', proposalVersion: proposed.body.booking.proposalVersion })).status, 404);
    assert.equal((await call(a, '/' + flexId, 'PATCH', { action: 'accept_time', proposalVersion: 'stale' })).status, 409);
    const declineTime = await call(a, '/' + flexId, 'PATCH', { action: 'decline_time', proposalVersion: proposed.body.booking.proposalVersion });
    assert.equal(declineTime.body.booking.status, 'pending'); assert.equal(declineTime.body.booking.startsAt, first);
    const inWindow = await call(otherProvider, '/' + flexId, 'PATCH', { action: 'confirm', startsAt: second });
    assert.equal(inWindow.body.booking.startsAt, second); assert.equal(inWindow.body.booking.scheduleConfirmed, true);
    await call(a, '/' + flexId, 'PATCH', { action: 'cancel' });

    // Multi-hour appointments block different starts and retain actual schedule gaps.
    assert.equal((await call(a, '/schedule-settings', 'PATCH', { durationMinutes: 180, bufferMinutes: 30 })).status, 403);
    assert.equal((await call(otherProvider, '/schedule-settings', 'PATCH', { durationMinutes: 0, bufferMinutes: 30 })).status, 400);
    assert.equal((await call(otherProvider, '/schedule-settings', 'PATCH', { durationMinutes: 180, bufferMinutes: 30 })).status, 200);
    for (const startsAt of [first, second, third]) await call(otherProvider, '/slots', 'POST', { startsAt });
    const alternatives = await call(a, '/alternatives/' + provider._id + '?startsAt=' + encodeURIComponent(first));
    assert.ok(alternatives.body.providers.some(p => p.id === String(otherProvider._id)));
    assert.equal(alternatives.body.providers[0].email, undefined);
    const long = await call(a, '', 'POST', { ...request, scheduleMode: 'published', requestId: 'long' });
    assert.equal(long.status, 201);
    const overlap = await call(b, '', 'POST', { ...request, scheduleMode: 'published', startsAt: second, requestId: 'overlap' });
    assert.equal(overlap.status, 409);
    const gap = (await call(a, '/availability/' + otherProvider._id)).body.slots;
    assert.equal(gap.find(s => s.startsAt === second).available, false); assert.equal(gap.find(s => s.startsAt === third).available, true);
    const requestedBusy = await call(b, '', 'POST', { ...request, startsAt: second, requestId: 'request-busy' });
    assert.equal(requestedBusy.status, 201);
    assert.equal((await call(otherProvider, '/' + requestedBusy.body.booking.id, 'PATCH', { action: 'confirm' })).status, 409);
    assert.equal((await call(a, '/alternatives/' + provider._id + '?startsAt=' + encodeURIComponent(second))).body.providers.length, 0);
    const alternativeTime = await call(otherProvider, '/' + requestedBusy.body.booking.id, 'PATCH', { action: 'propose_time', startsAt: third });
    const acceptedTime = await call(b, '/' + requestedBusy.body.booking.id, 'PATCH', { action: 'accept_time', proposalVersion: alternativeTime.body.booking.proposalVersion });
    assert.equal(acceptedTime.status, 200); assert.equal(acceptedTime.body.booking.startsAt, third);
    assert.equal((await call(otherProvider, '/' + requestedBusy.body.booking.id, 'PATCH', { action: 'start' })).status, 409);
    // Moving an appointment releases its old reservation and preserves the agreed scope.
    const nextDay = new Date(new Date(first).getTime() + 86400000).toISOString();
    const movedRequest = await call(a, '/' + long.body.booking.id, 'PATCH', { action: 'reschedule', scheduleMode: 'preferred', startsAt: nextDay });
    assert.equal(movedRequest.status, 200); assert.equal(movedRequest.body.booking.scheduleConfirmed, false);
    assert.equal((await Booking.findById(long.body.booking.id)).slotKey, undefined);
    assert.equal((await call(otherProvider, '/' + long.body.booking.id, 'PATCH', { action: 'confirm' })).status, 200);
    // Different published starts must still serialize when their service intervals overlap.
    const later = t => new Date(new Date(new Date(day + 'T' + t + ':00+05:30')).getTime() + 2 * 86400000).toISOString();
    for (const startsAt of [later('08:00'), later('10:30')]) await call(otherProvider, '/slots', 'POST', { startsAt });
    const intervalRace = await Promise.all([
      call(a, '', 'POST', { ...request, scheduleMode: 'published', startsAt: later('08:00'), requestId: 'interval-a' }),
      call(b, '', 'POST', { ...request, scheduleMode: 'published', startsAt: later('10:30'), requestId: 'interval-b' }),
    ]);
    assert.deepEqual(intervalRace.map(r => r.status).sort(), [201, 409]);
    const occupiedRace = intervalRace.find(r => r.status === 201).body.booking;
    const raceOwner = intervalRace[0].status === 201 ? a : b, raceOther = intervalRace[0].status === 201 ? b : a;
    const ownAvailability = await call(raceOwner, '/availability/' + otherProvider._id + '?excludeBookingId=' + occupiedRace.id);
    assert.equal(ownAvailability.body.slots.find(s => s.startsAt === occupiedRace.startsAt).available, true);
    const otherAvailability = await call(raceOther, '/availability/' + otherProvider._id + '?excludeBookingId=' + occupiedRace.id);
    assert.equal(otherAvailability.body.slots.find(s => s.startsAt === occupiedRace.startsAt).available, false);

    // Suggestions do not hold times; customer acceptance rechecks availability atomically.
    const suggestStart = new Date(new Date(first).getTime() + 4 * 86400000).toISOString();
    const pref = await call(a, '', 'POST', { ...request, startsAt: suggestStart, requestId: 'suggest-race' });
    const suggestion = await call(otherProvider, '/' + pref.body.booking.id, 'PATCH', { action: 'propose_time', startsAt: suggestStart });
    await call(otherProvider, '/slots', 'POST', { startsAt: suggestStart });
    assert.equal((await call(b, '', 'POST', { ...request, scheduleMode: 'published', startsAt: suggestStart, requestId: 'take-suggestion' })).status, 201);
    assert.equal((await call(a, '/' + pref.body.booking.id, 'PATCH', { action: 'accept_time', proposalVersion: suggestion.body.booking.proposalVersion })).status, 409);
    assert.equal((await Booking.findById(pref.body.booking.id)).status, 'time_proposed');
    assert.equal((await Booking.findById(pref.body.booking.id)).slotKey, undefined);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && /^fixmate_booking_test_[a-f0-9]{16}$/.test(dbName)) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
