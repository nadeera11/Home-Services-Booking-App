import api from './api';
export const paymentService = { update: async (id, data) => (await api.patch('/payments/' + id, data)).data.booking };
