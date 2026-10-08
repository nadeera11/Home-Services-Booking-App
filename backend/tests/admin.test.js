const { test } = require('node:test');
const assert = require('node:assert/strict');
const { accountInput } = require('../controllers/adminController');

test('admin account validation rejects malformed input and normalizes account fields', () => {
  const valid = { name: ' Test Admin ', email: ' ADMIN@example.test ', phone: ' 0771234567 ', password: 'Test-password' };
  assert.deepEqual(accountInput(valid, true), { name: 'Test Admin', email: 'admin@example.test', phone: '0771234567', password: 'Test-password' });
  for (const input of [null, { ...valid, name: ' ' }, { ...valid, email: {} }, { ...valid, email: 'bad' }, { ...valid, phone: [] }, { ...valid, phone: '123' }, { ...valid, password: null }, { ...valid, password: 'short' }, { ...valid, password: 'x'.repeat(73) }]) assert.throws(() => accountInput(input, true));
  assert.equal(accountInput({ ...valid, password: '' }).password, undefined);
});

test('all restored admin routes require authentication and the admin role', async t => {
  const User = require('../models/User'), jwt = require('jsonwebtoken'), express = require('express');
  t.mock.method(User, 'findById', id => ({ select: async () => ({ _id: id, role: id === 'admin' ? 'admin' : 'customer' }) }));
  const app = express(); app.use(express.json()); app.use('/api/admin', require('../routes/adminRoutes'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const [path, method] of [['users', 'GET'], ['create-admin', 'POST'], ['profile', 'PUT'], ['profile', 'DELETE']]) {
      const url = `http://127.0.0.1:${server.address().port}/api/admin/${path}`;
      assert.equal((await fetch(url, { method })).status, 401);
      const token = jwt.sign({ id: 'customer' }, process.env.JWT_SECRET || 'fixmate_super_secret_jwt_key_2026');
      assert.equal((await fetch(url, { method, headers: { Authorization: 'Bearer ' + token } })).status, 403);
      if (['POST', 'PUT'].includes(method)) {
        const adminToken = jwt.sign({ id: 'admin' }, process.env.JWT_SECRET || 'fixmate_super_secret_jwt_key_2026');
        assert.equal((await fetch(url, { method, headers: { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
      }
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('restored admin lifecycle and concurrent last-admin protection in isolated MongoDB', { skip: process.env.RUN_ADMIN_INTEGRATION !== '1', timeout: 90000 }, async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
  const mongoose = require('mongoose'), User = require('../models/User'), jwt = require('jsonwebtoken');
  const dbName = 'fixmate_admin_test_' + require('crypto').randomBytes(8).toString('hex'); let server;
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName, serverSelectionTimeoutMS: 10000 }); await User.init();
    const first = await User.create({ name: 'First Admin', email: 'first@example.test', phone: '0700000101', password: 'Test-password', role: 'admin', isVerified: true });
    const customer = await User.create({ name: 'Customer', email: 'customer@example.test', phone: '0700000102', password: 'Test-password', role: 'customer', otp: '123456' });
    const express = require('express'), app = express(); app.use(express.json()); app.use('/api/admin', require('../routes/adminRoutes')); app.use('/api/auth', require('../routes/authRoutes'));
    server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const call = async (user, path, method = 'GET', data) => {
      const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET);
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/${path}`, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
      return { status: response.status, body: await response.json() };
    };
    const listing = await call(first, 'users'); assert.equal(listing.status, 200); assert.equal(listing.body.total, 2);
    for (const user of listing.body.users) for (const field of ['password', 'otp', 'otpExpires', 'otpAttempts']) assert.equal(user[field], undefined);
    assert.equal((await call(customer, 'users')).status, 403);
    assert.equal((await call(first, 'profile', 'DELETE', { password: 'wrong' })).status, 400);
    assert.equal((await call(first, 'profile', 'DELETE', { password: 'Test-password' })).status, 409);
    const form = { name: 'Second Admin', email: ' SECOND@example.test ', phone: '0700000103', password: 'Test-password', confirmPassword: 'Test-password', role: 'customer', isVerified: false };
    assert.equal((await call(first, 'create-admin', 'POST', { ...form, confirmPassword: 'different' })).status, 400);
    const created = await call(first, 'create-admin', 'POST', form); assert.equal(created.status, 201); assert.equal(created.body.admin.role, 'admin'); assert.equal(created.body.admin.password, undefined);
    const second = await User.findById(created.body.admin.id); assert.equal(second.isVerified, true); assert.equal(second.email, 'second@example.test'); assert.notEqual(second.password, form.password); assert.equal(await second.matchPassword(form.password), true);
    assert.equal((await call(first, 'create-admin', 'POST', form)).status, 409);
    const updated = await call(first, 'profile', 'PUT', { name: 'Updated Admin', email: 'updated@example.test', phone: '0700000101', password: 'Updated-password', role: 'customer', _id: second._id });
    assert.equal(updated.status, 200); assert.equal(updated.body.user.id, String(first._id)); assert.equal(updated.body.user.role, 'admin'); assert.equal((await User.findById(second._id)).name, 'Second Admin');
    assert.equal(await (await User.findById(first._id)).matchPassword('Updated-password'), true);
    assert.equal((await call(first, 'profile', 'PUT', { name: 'Updated Admin', email: second.email, phone: '0700000101' })).status, 409);
    const deletes = await Promise.all([call(first, 'profile', 'DELETE', { password: 'Updated-password' }), call(second, 'profile', 'DELETE', { password: 'Test-password' })]);
    assert.deepEqual(deletes.map(r => r.status).sort(), [200, 409]); assert.equal(await User.countDocuments({ role: 'admin' }), 1); assert.ok(await User.findById(customer._id));
    const removed = deletes[0].status === 200 ? first : second; assert.equal((await call(removed, 'users')).status, 401);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && /^fixmate_admin_test_[a-f0-9]{16}$/.test(dbName)) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});
