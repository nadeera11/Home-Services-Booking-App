const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBookingController } = require('../controllers/bookingController');
test('chat combines only the owned customer/provider pair across bookings', async () => {
  let owner, pair, allowed = true;
  const Booking = {
    findOne(q) { owner = q; return { select() { return this; }, async lean() { return allowed ? { customer: 'c1', provider: 'p1' } : null; } }; },
    find(q) { pair = q; return { select() { return this; }, async lean() { return [
      { _id: 'b2', messages: [{ id: 'same', text: 'Later', createdAt: '2026-10-02' }] },
      { _id: 'b1', messages: [{ id: 'same', text: 'Earlier', createdAt: '2026-10-01' }] },
    ]; } }; },
  };
  const controller = createBookingController(Booking, {});
  const req = { params: { id: '123456789012345678901234' }, user: { role: 'customer', _id: 'c1' } };
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } });
  const res = response(); await controller.messages(req, res);
  assert.equal(owner.customer, 'c1'); assert.deepEqual(pair, { customer: 'c1', provider: 'p1' });
  assert.deepEqual(res.body.messages.map(m => m.text), ['Earlier', 'Later']);
  assert.equal(new Set(res.body.messages.map(m => m.id)).size, 2);
  allowed = false; pair = null;
  const denied = response(); await controller.messages(req, denied);
  assert.equal(denied.code, 404); assert.equal(pair, null);
});
