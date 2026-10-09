import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/constants/providerData.js', import.meta.url), 'utf8');
const { providerMetrics } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const now = new Date('2026-10-08T20:00:00Z'); // 9 October in Sri Lanka.
const receipt = (id, amount, paidAt) => ({ id, status: 'completed', invoice: { totalMinor: amount }, payment: { status: 'paid', paidAt } });
test('received totals exclude reports, unpaid invoices, quotes and future receipts', () => {
  const rows = [
    receipt('today', 250035, '2026-10-08T19:00:00Z'),
    receipt('monday', 10000, '2026-10-04T19:00:00Z'),
    receipt('previous-week', 5000, '2026-10-04T18:00:00Z'),
    receipt('last-month', 9900, '2026-09-30T18:00:00Z'),
    receipt('future', 999999, '2026-10-09T20:00:00Z'),
    { invoice: { totalMinor: 20000 }, payment: { status: 'awaiting_confirmation' } },
    { invoice: { totalMinor: 30000 }, payment: { status: 'unpaid' } },
    { status: 'confirmed', quote: { totalMinor: 999999, status: 'accepted' } },
  ];
  const original = JSON.stringify(rows), result = providerMetrics(rows, now);
  assert.equal(result.weekReceived, 260035);
  assert.equal(result.monthReceived, 265035);
  assert.equal(result.awaiting, 20000); assert.equal(result.unpaid, 30000);
  assert.equal(result.weeks.reduce((n, w) => n + w.amount, 0), result.monthReceived);
  assert.equal(JSON.stringify(rows), original);
});
test('today schedule requires confirmation and uses Sri Lanka date, not device time', () => {
  const base = { startsAt: '2026-10-08T19:00:00Z', scheduleConfirmed: true, status: 'confirmed' };
  const result = providerMetrics([
    { ...base, id: 'confirmed' }, { ...base, id: 'inspection', status: 'inspection_confirmed' },
    { ...base, id: 'unconfirmed', scheduleConfirmed: false, status: 'pending' },
    { ...base, id: 'cancelled', status: 'cancelled' },
    { ...base, id: 'yesterday', startsAt: '2026-10-08T18:00:00Z' },
  ], now);
  assert.deepEqual(result.today.map(b => b.id), ['confirmed', 'inspection']);
  assert.equal(result.active.length, 3);
});
test('empty earnings chart has zero totals, including short months', () => {
  const result = providerMetrics([], new Date('2027-02-28T12:00:00Z'));
  assert.equal(result.weeks.length, 4);
  assert.ok(result.weeks.every(w => w.amount === 0));
  assert.equal(result.weekReceived, 0); assert.deepEqual(result.today, []);
});
