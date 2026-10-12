import assert from "node:assert/strict";
import test from "node:test";
import { invitationEmailSetting } from "../src/invitation-email.ts";

// Whether the local API may email an invitation. No API or database needed:
//   node --test apps/local-api/tests/invitation-email-opt-in.mjs
const resend = { RESEND_API_KEY: "test-only", RESEND_FROM: "Commune <test@example.test>", APP_URL: "https://example.test" };

test("the Resend settings alone send nothing, and the log says how to opt in", () => {
  const setting = invitationEmailSetting(resend);
  assert.equal(setting.send, false);
  assert.equal(setting.notice, "Invitation email is off: the Resend settings are ignored unless LOCAL_API_SEND_EMAIL=yes is set as well.");
});

test("sends only with the opt-in and every Resend setting", () => {
  const setting = invitationEmailSetting({ ...resend, LOCAL_API_SEND_EMAIL: "yes" });
  assert.equal(setting.send, true);
  assert.match(setting.notice, /^Invitation email is on/);
  for (const missing of Object.keys(resend)) {
    const partial = invitationEmailSetting({ ...resend, LOCAL_API_SEND_EMAIL: "yes", [missing]: "" });
    assert.equal(partial.send, false, `sent without ${missing}`);
    assert.match(partial.notice, /also needs RESEND_API_KEY, RESEND_FROM and APP_URL/);
  }
});

test("only the exact opt-in counts", () => {
  for (const value of ["1", "true", "YES", " yes", "no", ""]) {
    assert.equal(invitationEmailSetting({ ...resend, LOCAL_API_SEND_EMAIL: value }).send, false, `sent with ${JSON.stringify(value)}`);
  }
});

test("off by default", () => {
  assert.deepEqual(invitationEmailSetting({}), { send: false, notice: "Invitation email is off. Invitation links can still be copied and shared." });
});
