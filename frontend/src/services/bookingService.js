import api from './api';

export const bookingService = {
  removeDay: async date => (await api.delete('/bookings/slots/day', { data: { date } })).data,
  messages: async (id, signal) => (await api.get(`/bookings/${id}/messages`, { signal })).data.messages,
  sendMessage: async (id, text, requestId) => (await api.post(`/bookings/${id}/messages`, { text, requestId })).data.messages,
  notifications: async signal => (await api.get('/bookings/notifications', { signal })).data.notifications,
  readNotification: async (id, eventId) => api.patch('/bookings/' + id + '/notifications/' + eventId + '/read'),
  removeSlot: async startsAt => (await api.delete('/bookings/slots', { data: { startsAt } })).data,
  pricing: async signal => (await api.get('/bookings/pricing', { signal })).data.pricing,
  savePricing: async data => (await api.patch('/bookings/pricing', data)).data.pricing,
  availability: async (providerId, signal, excludeBookingId) => (await api.get(`/bookings/availability/${providerId}`, { signal, params: { excludeBookingId } })).data,
  alternatives: async (providerId, startsAt, signal) => (await api.get(`/bookings/alternatives/${providerId}`, { signal, params: { startsAt } })).data.providers,
  saveScheduleSettings: async data => (await api.patch('/bookings/schedule-settings', data)).data,
  create: async data => (await api.post('/bookings', data)).data.booking,
  list: async signal => (await api.get('/bookings', { signal })).data.bookings,
  update: async (id, data) => (await api.patch(`/bookings/${id}`, data)).data.booking,
  publishSlot: async startsAt => (await api.post('/bookings/slots', { startsAt })).data,
};

export const BOOKING_TIMES = ['08:00', '10:30', '12:00', '14:00', '16:30', '18:00'];
export const bookingDate = (value, options = {}) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', day: 'numeric', month: 'short', ...options });
export const bookingTime = value => new Date(value).toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo', hour: 'numeric', minute: '2-digit' });
export const bookingWhen = value => `${bookingDate(value, { weekday: 'short' })} • ${bookingTime(value)}`;
export const bookingPreference = b => b.scheduleMode === 'flexible' && !b.scheduleConfirmed && b.windowEnd ? `${bookingDate(b.startsAt, { weekday: 'short' })} • ${bookingTime(b.startsAt)}–${bookingTime(b.windowEnd)} (preferred window)` : `${bookingWhen(b.startsAt)}${['pending', 'time_proposed'].includes(b.status) ? ' (requested)' : ''}`;
export const money = cents => 'LKR ' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const bookingPrice = p => {
  if (p.invoice) return money(p.invoice.totalMinor) + ' final total';
  if (p.quote?.status === 'accepted') return money(p.quote.totalMinor) + ' agreed total';
  const price = p.pricing;
  if (price?.type === 'fixed') return money(price.amountMinor) + ' fixed';
  if (price?.type === 'estimate') return money(price.minMinor) + ' – ' + money(price.maxMinor) + ' estimate';
  if (price?.type === 'inspection') return money(price.inspectionFeeMinor) + ' inspection fee';
  return 'Quote required · no charge agreed';
};
