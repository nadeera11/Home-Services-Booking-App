const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createProviderController, publicProvider } = require("../controllers/providerController");

const provider = { _id: "123456789012345678901234", name: "Test Provider", password: "secret", email: "private", otp: "123456", providerDetails: { category: "Plumbing", nicFront: "private-document", nicBack: "private-document", certificates: ["private-document"], price: 2500 } };
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
test("directory exposes public fields only, never credentials or verification documents", () => {
  const result = publicProvider(provider);
  assert.equal(result.price, null);
  assert.equal(result.rating, null);
  assert.equal(result.latitude, null);
  assert.equal(result.verified, true);
  for (const secret of ["password", "email", "otp", "nicFront", "nicBack", "certificates"]) assert.ok(!JSON.stringify(result).includes(secret));
});

test("public pricing never exposes bank account instructions or treats an inspection fee as the repair price", () => {
  const fixture = { ...provider, providerDetails: { ...provider.providerDetails, pricing: { type: 'inspection', inspectionFeeMinor: 75000, inclusions: 'Diagnosis only', version: 'v1', bankDetails: 'PRIVATE BANK ACCOUNT' } } };
  const result = publicProvider(fixture);
  assert.equal(result.price, null);
  assert.equal(result.pricing.inspectionFeeMinor, 75000);
  assert.ok(!JSON.stringify(result).includes('PRIVATE BANK ACCOUNT'));
  assert.ok(!Object.hasOwn(result.pricing, 'bankDetails'));
});
test("list requires verified and approved providers and uses an inclusive projection", async () => {
  let query, projection;
  const controller = createProviderController({ find(q) { query = q; return { select(p) { projection = p; return this; }, sort() { return this; }, async lean() { return [provider]; } }; } });
  const res = response(); await controller.list({}, res);
  assert.deepEqual(query, { role: "provider", isVerified: true, isApprovedByAdmin: true, "providerDetails.approvalStatus": "approved" });
  assert.ok(!projection.includes("nicFront")); assert.ok(!projection.includes("-password"));
  assert.equal(res.body.total, 1); assert.equal(res.body.providers[0].id, provider._id);
});
test("profile rejects malformed IDs before querying, and hides unavailable providers", async () => {
  let query;
  const controller = createProviderController({ findOne(q) { query = q; return { select() { return this; }, async lean() { return null; } }; } });
  const invalid = response(); await controller.detail({ params: { id: "bad-id" } }, invalid); assert.equal(invalid.code, 400); assert.equal(query, undefined);
  const missing = response(); await controller.detail({ params: { id: provider._id } }, missing); assert.equal(missing.code, 404); assert.equal(query.isApprovedByAdmin, true); assert.equal(query.isVerified, true);
});
test("database errors produce a retryable response without leaking details", async () => {
  const controller = createProviderController({ find() { throw new Error("private database URI"); } });
  const res = response(); await controller.list({}, res); assert.equal(res.code, 503); assert.ok(!JSON.stringify(res.body).includes("URI"));
});

test("provider routes require a valid session before exposing the directory", async () => {
  const express = require("express");
  const app = express();
  app.use("/api/providers", require("../routes/providerRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/providers`;
    for (const path of ["", `/${provider._id}`]) {
      const res = await fetch(base + path);
      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { message: "Not authorized, no token provided" });
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
