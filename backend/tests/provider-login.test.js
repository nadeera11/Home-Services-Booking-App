const { test } = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/User");
const { login } = require("../controllers/authController");

function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function account(overrides = {}) {
  return { _id: "123456789012345678901234", role: "provider", name: "Test Provider", email: "provider@example.test", isVerified: true, isApprovedByAdmin: true, providerDetails: { approvalStatus: "approved" }, matchPassword: async () => true, ...overrides };
}
test("provider login preserves admin approval and credential checks", async t => {
  t.mock.method(User, "findOne");
  const cases = [
    ["pending", account({ isApprovedByAdmin: false, providerDetails: { approvalStatus: "pending" } }), 403],
    ["rejected", account({ isApprovedByAdmin: false, providerDetails: { approvalStatus: "rejected", rejectionReason: "Invalid documentation" } }), 403],
    ["inconsistent approval flags", account({ providerDetails: { approvalStatus: "pending" } }), 403],
    ["wrong password", account({ matchPassword: async () => false }), 401],
    ["approved", account(), 200],
  ];
  for (const [name, user, status] of cases) {
    User.findOne.mock.mockImplementation(async () => user);
    const res = response(); await login({ body: { identifier: "provider@example.test", password: "test-only" } }, res);
    assert.equal(res.code, status, name);
    if (status === 403) { assert.equal(res.body.requiresAdminApproval, true); assert.equal(res.body.token, undefined); }
    if (status === 200) { assert.equal(res.body.user.role, "provider"); assert.equal(typeof res.body.token, "string"); }
    if (name === "rejected") assert.equal(res.body.approvalStatus, "rejected");
  }
});
