// Actual Expo UI with isolated API fixtures. Backend rules are covered separately.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    let pricing = null, review = null, failReview = true, created = null;
    const start = new Date(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + 'T08:00:00+05:30').toISOString();
    const provider = () => ({ id: 'fixture-provider', name: 'Test Provider', category: 'Plumbing', verified: true, acceptingRequests: true, pricing, referencePrice: pricing ? null : 2500, priceUnit: 'visit', rating: review?.rating || null, reviewCount: review ? 1 : 0, reviews: review ? [{ ...review, customerName: 'Test', service: 'Plumbing' }] : [] });
    const job = () => ({ id: 'fixture-job', version: review ? 1 : 0, reference: 'FM-TEST', customerName: 'Test Customer', providerId: 'fixture-provider', providerName: 'Test Provider', service: 'Plumbing', startsAt: start, status: 'completed', review, payment: { status: 'unpaid' } });
    async function open(role) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(() => localStorage.setItem('userToken', 'isolated-fixture'));
      await ctx.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname.replace(/^.*\/api/, ''), body = req.postDataJSON() || {};
        let data = {}, status = 200;
        if (path === '/auth/me') data = { user: { id: 'fixture-' + role, name: 'Test ' + role, role, isVerified: true, isApprovedByAdmin: true, providerDetails: { approvalStatus: 'approved', category: 'Plumbing', pricing } } };
        else if (path === '/bookings/pricing') {
          if (req.method() === 'PATCH') pricing = { type: body.type, minMinor: body.min * 100, maxMinor: body.max * 100, inclusions: body.inclusions, version: 'v1' };
          data = { pricing };
        } else if (path === '/bookings/fixture-job/review') {
          if (failReview) { failReview = false; status = 503; data = { message: 'Temporary review failure.' }; }
          else { review = { rating: body.rating, comment: body.comment, createdAt: new Date().toISOString() }; data = { booking: job() }; }
        } else if (path === '/bookings') {
          if (req.method() === 'POST') { created = body; data = { booking: { ...body, id: 'new-booking', reference: 'FM-NEW', status: 'pending' } }; }
          else data = { bookings: [job()] };
        } else if (path === '/bookings/notifications') data = { notifications: [] };
        else if (path === '/providers') data = { providers: [provider()] };
        else if (path === '/providers/fixture-provider') data = { provider: provider() };
        else if (path === '/bookings/availability/fixture-provider') data = { pricing, referencePrice: pricing ? null : 2500, priceUnit: 'visit', slots: [{ startsAt: start, date: new Date(Date.parse(start) + 19800000).toISOString().slice(0, 10), available: true }] };
        await route.fulfill({ status, json: data });
      });
      const page = await ctx.newPage();
      page.on('pageerror', error => { throw error; });
      await page.goto(process.env.FIXMATE_AUDIT_URL || 'http://localhost:8093', { timeout: 120000 });
      return page;
    }
    const btn = (page, name) => page.getByRole('button', { name, exact: true });
    const customer = await open('customer');
    await customer.getByRole('tab', { name: /Explore/ }).click();
    await btn(customer, "View Test Provider's profile").click();
    await customer.getByRole('dialog').getByText('LKR 2,500.00 per visit · reference rate', { exact: true }).waitFor();
    const providerPage = await open('provider');
    await providerPage.getByRole('tab', { name: /Profile/ }).click();
    await btn(providerPage, 'Set service pricing').click();
    await providerPage.getByRole('radio', { name: /Estimate range/ }).click();
    await btn(providerPage, 'Publish pricing').click();
    await providerPage.getByRole('alert').waitFor();
    await providerPage.getByRole('textbox', { name: 'Minimum estimate (LKR)', exact: true }).fill('1200');
    await providerPage.getByRole('textbox', { name: 'Maximum estimate (LKR)', exact: true }).fill('2500');
    await providerPage.getByRole('textbox', { name: 'Included scope *', exact: true }).fill('Tap repair labour');
    await btn(providerPage, 'Publish pricing').click();
    await providerPage.getByText(/Pricing published/).waitFor();
    assert.equal(pricing.minMinor, 120000);
    await customer.reload();
    await customer.getByRole('tab', { name: /Bookings/ }).click();
    await customer.getByRole('tab', { name: 'Completed', exact: true }).click();
    await btn(customer, 'Rate & review service').click();
    await btn(customer, 'Write a review').click();
    await btn(customer, 'Submit review').click();
    await customer.getByText('Choose a star rating from 1 to 5.', { exact: true }).waitFor();
    await customer.getByRole('radio', { name: '4 stars', exact: true }).click();
    await customer.getByRole('textbox', { name: 'Review comment, optional' }).fill('Clear communication and careful repair.');
    await btn(customer, 'Submit review').click();
    await customer.getByText(/Temporary review failure/).waitFor();
    assert.equal(await customer.getByRole('textbox', { name: 'Review comment, optional' }).inputValue(), 'Clear communication and careful repair.');
    await btn(customer, 'Submit review').click();
    await customer.getByText('4 out of 5 stars · Verified booking', { exact: true }).waitFor();
    await customer.reload();
    await customer.getByRole('tab', { name: /Bookings/ }).click();
    await customer.getByRole('tab', { name: 'Completed', exact: true }).click();
    await btn(customer, 'View your review').waitFor();
    await customer.getByRole('tab', { name: /Explore/ }).click();
    await btn(customer, "View Test Provider's profile").click();
    await customer.getByText('Clear communication and careful repair.', { exact: true }).waitFor();
    await customer.getByRole('dialog').getByText('LKR 1,200.00 – LKR 2,500.00 estimate', { exact: true }).waitFor();
    await customer.screenshot({ path: '.expo/provider-review-public.png' });
    await customer.getByRole('button', { name: /Continue with Provider/ }).click();
    await customer.getByRole('textbox', { name: 'Problem description, required' }).fill('Fix a tap');
    await customer.getByRole('textbox', { name: 'Service location, required' }).fill('Isolated test address');
    await btn(customer, 'Choose date & time').click();
    await btn(customer, new Date(start).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', weekday: 'long', day: 'numeric', month: 'long' })).click();
    await btn(customer, '8:00 AM').click();
    await btn(customer, 'Review booking').click();
    assert.equal(await btn(customer, 'Send booking request').isDisabled(), true);
    await customer.getByRole('checkbox').click();
    await customer.setViewportSize({ width: 320, height: 740 });
    assert(await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await customer.screenshot({ path: '.expo/pricing-consent.png' });
    await btn(customer, 'Send booking request').click();
    await customer.getByText('Request sent successfully', { exact: true }).waitFor();
    assert.equal(created.acceptPricing, true); assert.equal(created.pricingVersion, 'v1');
    console.log('PASS reference rate, provider pricing validation/publication, review validation/recovery/reload, public review, estimate and required booking consent');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
