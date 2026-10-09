const { test } = require('node:test');
const assert = require('node:assert/strict');

test('review controller rejects invalid, unauthorized, incomplete and stale submissions', async () => {
  const { createBookingController } = require('../controllers/bookingController');
  let found = null, query;
  const controller = createBookingController({ async findOne(q) { query = q; return found; } }, {});
  const req = { params: { id: '123456789012345678901234' }, user: { role: 'customer', _id: 'customer-id' }, body: { rating: 4, comment: 'Good service', bookingVersion: 0 } };
  const run = async input => { const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; await controller.review(input, res); return res; };
  assert.equal((await run({ ...req, user: { role: 'provider' } })).code, 403);
  for (const rating of [0, 6, 2.5, '4']) assert.equal((await run({ ...req, body: { ...req.body, rating } })).code, 400);
  assert.equal((await run(req)).code, 404);
  assert.deepEqual(query, { _id: req.params.id, customer: 'customer-id' });
  found = { status: 'pending' };
  assert.equal((await run(req)).code, 409);
  found = { status: 'completed', __v: 1 };
  assert.equal((await run(req)).code, 409);
  found.review = { rating: 1, comment: 'Already reviewed' };
  assert.equal((await run(req)).code, 409);
});

test('verified reviews and published pricing use isolated records', { skip: process.env.RUN_REVIEW_INTEGRATION !== '1', timeout: 180000 }, async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
  const mongoose = require('mongoose'), dbName = 'fixmate_review_test_' + require('crypto').randomBytes(8).toString('hex');
  let server;
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName, serverSelectionTimeoutMS: 15000 });
    const User = require('../models/User'), Booking = require('../models/Booking');
    await Promise.all([User.init(), Booking.init()]);
    const make = (name, role, phone) => User.create({ name, email: name + '@example.test', phone, password: 'Isolated-password', role, isVerified: true, isApprovedByAdmin: true, providerDetails: { category: 'Plumbing', approvalStatus: 'approved', price: 2500 } });
    const [provider, customer, stranger] = await Promise.all([make('ReviewProvider', 'provider', '0700000091'), make('ReviewCustomer', 'customer', '0700000092'), make('Stranger', 'customer', '0700000093')]);
    const jwt = require('jsonwebtoken'), token = u => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const express = require('express'), app = express();
    app.use(express.json()); app.use('/api/providers', require('../routes/providerRoutes')); app.use('/api/bookings', require('../routes/bookingRoutes'));
    server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    const call = async (u, path, method = 'GET', body) => { const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(u ? { Authorization: 'Bearer ' + token(u) } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() }; };
    const booking = (status = 'completed') => Booking.create({ customer: customer._id, provider: provider._id, providerName: provider.name, customerName: customer.name, service: 'Plumbing', startsAt: new Date(Date.now() - 86400000), problem: 'Test repair', location: 'Private address', requestId: require('crypto').randomUUID(), status });
    const b = await booking(), pending = await booking('pending'), path = '/bookings/' + b._id + '/review', body = { rating: 5, comment: 'Careful service', bookingVersion: 0 };
    assert.equal((await call(null, path, 'POST', body)).status, 401);
    assert.equal((await call(provider, path, 'POST', body)).status, 403);
    assert.equal((await call(stranger, path, 'POST', body)).status, 404);
    assert.equal((await call(customer, '/bookings/' + pending._id + '/review', 'POST', body)).status, 409);
    for (const rating of [0, 6, 2.5, '5']) assert.equal((await call(customer, path, 'POST', { ...body, rating })).status, 400);
    assert.equal((await call(customer, path, 'POST', { ...body, comment: 'x'.repeat(1001) })).status, 400);
    assert.equal((await call(customer, path, 'POST', { ...body, bookingVersion: 99 })).status, 409);
    const simultaneous = await Promise.all([call(customer, path, 'POST', body), call(customer, path, 'POST', body)]);
    assert(simultaneous.some(r => r.status === 201), JSON.stringify(simultaneous));
    assert(simultaneous.every(r => [200, 201, 409].includes(r.status)));
    assert.equal((await call(customer, path, 'POST', body)).status, 200);
    assert.equal((await call(customer, path, 'POST', { ...body, rating: 4 })).status, 409);
    const second = await booking();
    assert.equal((await call(customer, '/bookings/' + second._id + '/review', 'POST', { rating: 3, comment: 'Useful visit', bookingVersion: 0 })).status, 201);
    const profile = (await call(customer, '/providers/' + provider._id)).data.provider;
    assert.equal(profile.rating, 4); assert.equal(profile.reviewCount, 2); assert.equal(profile.reviews.length, 2); assert.equal(profile.referencePrice, 2500); assert.equal(profile.pricing, null);
    assert(!JSON.stringify(profile.reviews).includes('Private address'));
    assert.equal((await call(provider, '/bookings')).data.bookings.find(x => x.id === String(b._id)).review.rating, 5);
    for (const p of [{ type: 'fixed', amount: 1800 }, { type: 'estimate', min: 1200, max: 2500 }, { type: 'inspection', inspectionFee: 500 }]) {
      assert.equal((await call(provider, '/bookings/pricing', 'PATCH', { ...p, inclusions: 'Agreed scope', bankDetails: 'PRIVATE BANK' })).status, 200);
      const publicP = (await call(customer, '/providers/' + provider._id)).data.provider;
      assert.equal(publicP.pricing.type, p.type); assert.equal(publicP.referencePrice, null); assert(!JSON.stringify(publicP).includes('PRIVATE BANK'));
    }
  } finally {
    if (server) await new Promise(r => server.close(r));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && /^fixmate_review_test_[a-f0-9]{16}$/.test(dbName)) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
