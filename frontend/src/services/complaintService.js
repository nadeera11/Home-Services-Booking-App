import api from './api';
export const complaintService = {
  list: async (bookingId, signal) => (await api.get('/complaints', { params: { bookingId }, signal })).data.complaints,
  create: async (bookingId, description) => (await api.post('/complaints', { bookingId, description })).data.complaint,
  update: async (id, data) => (await api.patch('/complaints/' + id, data)).data.complaint,
};
