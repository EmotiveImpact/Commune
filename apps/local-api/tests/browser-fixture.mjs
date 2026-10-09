import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Explicit opt-in: creates a private synthetic household in the local UI database.
// Never reads, changes or joins an existing user's household. No hosted endpoints.
if (process.env.SEED_LOCAL_BROWSER_FIXTURE !== "yes") {
  throw new Error(
    "Set SEED_LOCAL_BROWSER_FIXTURE=yes to create isolated local browser fixtures.",
  );
}
const base = "http://127.0.0.1:3002/api";
const suffix = randomUUID().slice(0, 8);
const password = "DisposableBrowserFixture-2026!";
function client() {
  let cookie = "";
  return async (method, path, input) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const data = await response.json();
    assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  };
}
const owner = client(),
  member = client();
const ownerEmail = `browser-owner-${suffix}@example.test`;
const account = await owner("POST", "/auth/signup", {
  name: "Browser QA",
  email: ownerEmail,
  password,
});
const guest = await member("POST", "/auth/signup", {
  name: "QA Member",
  email: `browser-member-${suffix}@example.test`,
  password,
});
const commune = await owner("POST", "/communes", {
  name: "Browser QA House",
  kind: "household",
  currency: "GBP",
  address: "Example address · local test only",
});
const invite = await owner("POST", `/communes/${commune.id}/invites`, {
  email: guest.user.email,
  role: "member",
});
await member("POST", `/invites/${invite.token}/accept`, {});
await owner("POST", "/communes", {
  name: "QA Weekend",
  kind: "trip",
  currency: "EUR",
});
const today = new Date().toISOString().slice(0, 10);
await owner("POST", `/communes/${commune.id}/expenses`, {
  title: "Weekly groceries",
  category: "Groceries",
  amountMinor: 4000,
  paidByUserId: account.user.id,
  dueOn: today,
  shares: [
    { userId: account.user.id, amountMinor: 2000 },
    { userId: guest.user.id, amountMinor: 2000 },
  ],
});
await member("POST", `/communes/${commune.id}/expenses`, {
  title: "Shared tickets",
  category: "Travel",
  amountMinor: 3000,
  paidByUserId: guest.user.id,
  dueOn: today,
  shares: [
    { userId: account.user.id, amountMinor: 1500 },
    { userId: guest.user.id, amountMinor: 1500 },
  ],
});
const fund = await owner("POST", `/communes/${commune.id}/funds`, {
  name: "Garden supplies",
  targetMinor: 10000,
});
await member("POST", `/funds/${fund.id}/pledges`, {
  amountMinor: 2000,
  dueOn: today,
});
await owner("POST", `/communes/${commune.id}/templates`, {
  name: "Household halves",
  method: "Equal",
  participants: [
    { userId: account.user.id, value: "" },
    { userId: guest.user.id, value: "" },
  ],
});
await owner("POST", `/communes/${commune.id}/recurring`, {
  title: "Internet",
  amountMinor: 2400,
  paidByUserId: account.user.id,
  frequency: "monthly",
  nextDueOn: today,
  paused: false,
  requestId: randomUUID(),
  allocations: [
    { userId: account.user.id, amountMinor: 1200 },
    { userId: guest.user.id, amountMinor: 1200 },
  ],
});
console.log(
  JSON.stringify({
    ownerEmail,
    communeId: commune.id,
    fixture: "private synthetic data on local API only",
  }),
);
