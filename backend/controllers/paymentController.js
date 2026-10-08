// All monetary totals are integer LKR cents. Never trust a client invoice total.
const minor = value => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new Error('Enter a valid amount with at most two decimal places.');
  return Math.round(value * 100);
};
function pricingInput(body) {
  const { type, inclusions, exclusions = '', bankDetails = '' } = body;
  if (typeof bankDetails !== 'string' || bankDetails.length > 1000) throw new Error('Bank transfer instructions must be at most 1000 characters.');
  if (!['fixed', 'estimate', 'inspection'].includes(type) || typeof inclusions !== 'string' || !inclusions.trim() || inclusions.length > 1000 || typeof exclusions !== 'string' || exclusions.length > 1000) throw new Error('Choose a pricing type and describe what is included.');
  const p = { bankDetails: bankDetails.trim(), type, inclusions: inclusions.trim(), exclusions: exclusions.trim(), inspectionFeeMinor: 0 };
  if (type === 'fixed') p.amountMinor = minor(body.amount);
  if (type === 'estimate') { p.minMinor = minor(body.min); p.maxMinor = minor(body.max); if (p.maxMinor < p.minMinor) throw new Error('Maximum estimate must be at least the minimum.'); }
  if (type === 'inspection') p.inspectionFeeMinor = minor(body.inspectionFee);
  return p;
}
function makeQuote(body, booking) {
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 20 || typeof body.scope !== 'string' || !body.scope.trim() || body.scope.length > 2000) throw new Error('Enter the work scope and 1–20 itemised charges.');
  const items = body.items.map(item => {
    if (!item || typeof item.description !== 'string' || !item.description.trim() || item.description.length > 200) throw new Error('Each quote item needs a description.');
    return { description: item.description.trim(), amountMinor: minor(item.amount) };
  });
  if (booking.inspectionPerformed && booking.pricing?.inspectionFeeMinor) items.unshift({ description: 'Agreed inspection fee (included once)', amountMinor: booking.pricing.inspectionFeeMinor });
  const totalMinor = items.reduce((total, item) => total + item.amountMinor, 0);
  if (totalMinor > 1000000000) throw new Error('Quote total is too large.');
  return { version: Math.max(booking.quote?.version || 0, ...(booking.quoteHistory || []).map(q => q?.version || 0)) + 1, items, scope: body.scope.trim(), totalMinor, status: 'pending', submittedAt: new Date() };
}
function invoiceFor(booking, inspectionOnly = false) {
  if (!inspectionOnly && booking.quote?.status !== 'accepted') throw new Error('An approved quote is required.');
  const items = inspectionOnly ? [{ description: 'Completed inspection — repair declined', amountMinor: booking.pricing?.inspectionFeeMinor || 0 }] : booking.quote.items;
  return { number: `INV-${booking._id}`, items, totalMinor: items.reduce((sum, item) => sum + item.amountMinor, 0), currency: 'LKR', bankDetails: booking.pricing?.bankDetails || '', issuedAt: new Date(), quoteVersion: inspectionOnly ? null : booking.quote.version, inspectionOnly };
}
function createPaymentController(Booking) {
  return async (req, res) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid booking.' });
      const provider = req.user.role === 'provider';
      const owner = provider ? { provider: req.user._id } : { customer: req.user._id };
      const b = await Booking.findOne({ _id: req.params.id, ...owner });
      if (!b) return res.status(404).json({ message: 'Booking not found.' });
      if (b.status !== 'completed' || !b.invoice) return res.status(409).json({ message: 'Payment is available only after completion and an approved invoice.' });
      const { action, method, reference = '' } = req.body || {};
      if (b.payment?.status === 'paid') return res.json({ booking: require('./bookingController').dto(b) });
      let payment;
      if (!provider && action === 'report') {
        if (!['cash', 'bank_transfer'].includes(method) || typeof reference !== 'string' || reference.length > 200 || (method === 'bank_transfer' && !reference.trim())) return res.status(400).json({ message: 'Choose cash or bank transfer and enter the transfer reference when applicable.' });
        if (method === 'bank_transfer' && !b.invoice.bankDetails) return res.status(409).json({ message: 'Bank transfer is not configured for this invoice. Use cash.' });
        if (b.payment?.status === 'awaiting_confirmation') return res.status(409).json({ message: 'Your payment is already awaiting provider confirmation.' });
        payment = { status: 'awaiting_confirmation', method, reference: reference.trim(), reportedAt: new Date() };
      } else if (provider && ['confirm', 'reject'].includes(action) && b.payment?.status === 'awaiting_confirmation') {
        if (req.body.reportedAt !== b.payment.reportedAt?.toISOString()) return res.status(409).json({ message: 'The payment report changed. Refresh before confirming.' });
        if (!req.user.isVerified || !req.user.isApprovedByAdmin || req.user.providerDetails?.approvalStatus !== 'approved') return res.status(403).json({ message: 'Provider approval is required.' });
        payment = action === 'confirm' ? { ...b.payment.toObject(), status: 'paid', paidAt: new Date(), confirmedBy: req.user._id, receipt: `RCPT-${b._id}` } : { status: 'unpaid' };
      } else return res.status(409).json({ message: 'This payment action is not available.' });
      const updated = await Booking.findOneAndUpdate({ _id: b._id, ...owner, __v: b.__v }, { $set: { payment }, $inc: { __v: 1 }, $push: { history: { status: b.status, action: 'payment_' + action, at: new Date() }, ...(!provider ? { providerNotifications: require('./bookingController').event('payment', 'Customer reported a payment. Confirm receipt.') } : {}) } }, { returnDocument: 'after', runValidators: true });
      if (!updated) return res.status(409).json({ message: 'Payment changed. Refresh before trying again.' });
      res.json({ booking: require('./bookingController').dto(updated) });
    } catch { res.status(503).json({ message: 'Unable to update payment. Please try again.' }); }
  };
}
function publicPricing(p) { if (!p) return null; const { bankDetails, ...pricing } = p; return pricing; }
module.exports = { publicPricing, minor, pricingInput, makeQuote, invoiceFor, createPaymentController };
