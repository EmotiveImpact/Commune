import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Deliberately refuse the normal application API: these tests create fixtures.
const base = process.env.API_BASE;
if (!base)
  throw new Error(
    "Set API_BASE to an isolated local test API, not the user's database.",
  );
const url = new URL(base);
if (
  url.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  !url.port ||
  url.port === "3002" ||
  url.pathname !== "/" ||
  url.search ||
  url.hash ||
  url.username ||
  url.password
)
  throw new Error(
    "Workflow tests require an isolated loopback API port (not 3002).",
  );
// Letters only, so a commune name that carries it never holds a phone-like run
// of digits.
const suffix = randomUUID()
  .slice(0, 8)
  .replace(/[0-9]/g, (digit) => "ghijklmnop"[digit]);
const password = "DisposableWorkflowFixture-2026!";
function session() {
  let cookie = "";
  return async (method, path, input) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: response.status, ...(await response.json()) };
  };
}
const a = session(),
  b = session(),
  c = session(),
  outsider = session();
const users = [];
for (const [index, call] of [a, b, c, outsider].entries()) {
  const result = await call("POST", "/auth/signup", {
    name: `Workflow ${index}`,
    email: `workflows-${index}-${suffix}@example.test`,
    password,
  });
  assert.equal(result.status, 201, JSON.stringify(result));
  users.push(result.user);
}
const [alice, bob, carol, stranger] = users;
const created = await a("POST", "/communes", {
  name: `Workflow test ${suffix}`,
  kind: "household",
  currency: "GBP",
});
assert.equal(created.status, 201, JSON.stringify(created));
const id = created.id;
for (const [user, call] of [
  [bob, b],
  [carol, c],
]) {
  const invite = await a("POST", `/communes/${id}/invites`, {
    email: user.email,
    role: "member",
  });
  assert.equal(invite.status, 201, JSON.stringify(invite));
  assert.equal(
    (await call("POST", `/invites/${invite.token}/accept`, {})).communeId,
    id,
  );
}
const get = () => a("GET", `/communes/${id}/snapshot`);
let snap = await get();
assert.equal(snap.status, 200, JSON.stringify(snap));
assert.equal(snap.members.length, 3);
assert.equal(snap.commune.memberCount, 3);
assert.equal((await outsider("GET", `/communes/${id}/snapshot`)).status, 404);

// Payer, exact allocations, categories, and authority come from validated RPCs.
const expenseInput = {
  title: "Shared tickets",
  amountMinor: 1000,
  paidByUserId: bob.id,
  category: "Travel",
  dueOn: "2026-01-01",
  shares: [{ userId: carol.id, amountMinor: 1000 }],
};
assert.equal(
  (
    await b("POST", `/communes/${id}/expenses`, {
      ...expenseInput,
      paidByUserId: alice.id,
    })
  ).status,
  403,
);
assert.equal(
  (
    await a("POST", `/communes/${id}/expenses`, {
      ...expenseInput,
      shares: [{ userId: stranger.id, amountMinor: 1000 }],
    })
  ).status,
  400,
);
assert.equal(
  (
    await a("POST", `/communes/${id}/expenses`, {
      ...expenseInput,
      shares: [{ userId: carol.id, amountMinor: 500 }],
    })
  ).status,
  400,
);
assert.equal(
  (
    await a("POST", `/communes/${id}/expenses`, {
      ...expenseInput,
      shares: [
        { userId: carol.id, amountMinor: 500 },
        { userId: carol.id, amountMinor: 500 },
      ],
    })
  ).status,
  400,
);
const expense = await a("POST", `/communes/${id}/expenses`, expenseInput);
assert.equal(expense.status, 201, JSON.stringify(expense));
snap = await get();
const saved = snap.expenses.find((row) => row.id === expense.id);
assert.equal(saved.category, "Travel");
assert.equal(saved.paidByUserId, bob.id);
assert.equal(saved.shares.length, 1);
assert.equal(
  (await a("POST", `/shares/${saved.shares[0].id}/confirm`, {})).status,
  403,
);
assert.equal(
  (await c("POST", `/shares/${saved.shares[0].id}/confirm`, {})).status,
  403,
);
assert.equal(
  (await c("POST", `/communes/${id}/members/${carol.id}`, { action: "leave" }))
    .status,
  409,
);
assert.equal(
  (await b("POST", `/shares/${saved.shares[0].id}/confirm`, {})).status,
  200,
);
assert.equal(
  (await c("POST", `/communes/${id}/members/${carol.id}`, { action: "leave" }))
    .status,
  200,
);
assert.equal((await c("GET", `/communes/${id}/snapshot`)).status, 404);
assert.equal((await c("GET", "/communes")).communes.length, 0);
snap = await get();
assert.equal(
  snap.members.find((member) => member.userId === carol.id).active,
  false,
);
assert.equal(snap.expenses[0].shares[0].settledMinor, 1000);
const reInvite = await a("POST", `/communes/${id}/invites`, {
  email: carol.email,
  role: "member",
});
assert.equal(reInvite.status, 201, JSON.stringify(reInvite));
assert.equal(
  (await c("POST", `/invites/${reInvite.token}/accept`, {})).status,
  200,
);
assert.equal(
  (await a("POST", `/communes/${id}/members/${alice.id}`, { action: "member" }))
    .status,
  409,
);
assert.equal(
  (await c("POST", `/communes/${id}/members/${bob.id}`, { action: "admin" }))
    .status,
  403,
);

// Funds are recoverable and contributions have retained correction history.
const fund = await a("POST", `/communes/${id}/funds`, {
  name: "Shared supplies",
  targetMinor: 10000,
});
assert.equal(fund.status, 201, JSON.stringify(fund));
assert.equal(
  (await b("POST", `/communes/${id}/funds`, { name: "Not authorised" })).status,
  403,
);
assert.equal(
  (
    await b("PATCH", `/funds/${fund.id}`, {
      name: "Not authorised",
      targetMinor: 12000,
    })
  ).status,
  403,
);
assert.equal(
  (
    await a("PATCH", `/funds/${fund.id}`, {
      name: "House supplies",
      targetMinor: 12000,
    })
  ).status,
  200,
);
const pledge = await b("POST", `/funds/${fund.id}/pledges`, {
  amountMinor: 1000,
  dueOn: "2026-01-01",
});
assert.equal(pledge.status, 201, JSON.stringify(pledge));
assert.equal(
  (
    await b("PATCH", `/commitments/${pledge.id}`, {
      amountMinor: 1200,
      dueOn: "2026-01-01",
    })
  ).status,
  200,
);
assert.equal(
  (await c("PATCH", `/commitments/${pledge.id}`, { cancel: true })).status,
  403,
);
assert.equal(
  (await a("POST", `/funds/${fund.id}/archive`, { archived: true })).status,
  409,
);
const contribution = await a(
  "POST",
  `/commitments/${pledge.id}/contributions`,
  { amountMinor: 200 },
);
assert.equal(contribution.status, 201, JSON.stringify(contribution));
assert.equal(
  (
    await b("PATCH", `/commitments/${pledge.id}`, {
      amountMinor: 100,
      dueOn: "2026-01-01",
    })
  ).status,
  400,
);
assert.equal(
  (await b("PATCH", `/commitments/${pledge.id}`, { cancel: true })).status,
  409,
);
assert.equal(
  (
    await c("POST", `/contributions/${contribution.id}/void`, {
      reason: "Recorded incorrectly",
    })
  ).status,
  403,
);
assert.equal(
  (
    await a("POST", `/contributions/${contribution.id}/void`, {
      reason: "Recorded incorrectly",
    })
  ).status,
  200,
);
snap = await get();
let committed = snap.funds[0].commitments[0];
assert.equal(committed.contributedMinor, 0);
assert.ok(committed.contributions[0].voidedAt);
assert.equal(committed.contributions[0].voidReason, "Recorded incorrectly");
assert.equal(
  (await b("PATCH", `/commitments/${pledge.id}`, { cancel: true })).status,
  200,
);
snap = await get();
assert.ok(snap.funds[0].commitments[0].cancelledAt);
assert.ok(
  !snap.reminderTargets.some((target) => target.sourceId === pledge.id),
);
assert.notEqual(
  (await a("POST", "/reminders", { kind: "chase", sourceId: pledge.id }))
    .status,
  201,
);
assert.equal(
  (await a("POST", `/funds/${fund.id}/archive`, { archived: true })).status,
  200,
);
assert.equal(
  (
    await b("POST", `/funds/${fund.id}/pledges`, {
      amountMinor: 1500,
      dueOn: "2026-01-01",
    })
  ).status,
  400,
);
assert.equal(
  (await a("POST", `/funds/${fund.id}/archive`, { archived: false })).status,
  200,
);
const again = await b("POST", `/funds/${fund.id}/pledges`, {
  amountMinor: 1500,
  dueOn: "2026-01-01",
});
assert.equal(again.id, pledge.id);
assert.equal(
  (
    await a("POST", `/commitments/${pledge.id}/contributions`, {
      amountMinor: 1501,
    })
  ).status,
  400,
);
assert.equal(
  (await a("POST", "/reminders", { kind: "chase", sourceId: pledge.id }))
    .status,
  201,
);
assert.equal(
  (await a("POST", "/reminders", { kind: "chase", sourceId: pledge.id }))
    .status,
  409,
);
assert.equal((await a("GET", "/reminders/usage")).totalUsed, 1);

// Persist all split methods, but never let templates bypass financial checks.
const split = {
  name: "House split",
  method: "Percentage",
  participants: [
    { userId: bob.id, value: "60" },
    { userId: carol.id, value: "40" },
  ],
};
const template = await b("POST", `/communes/${id}/templates`, split);
assert.equal(template.status, 201, JSON.stringify(template));
assert.equal(
  (
    await b("POST", `/communes/${id}/templates`, {
      ...split,
      participants: [{ userId: bob.id, value: "110" }],
    })
  ).status,
  400,
);
assert.equal(
  (
    await b("POST", `/communes/${id}/templates`, {
      ...split,
      participants: [{ userId: bob.id, value: "oops" }],
    })
  ).status,
  400,
);
assert.equal(
  (await outsider("POST", `/communes/${id}/templates`, split)).status,
  403,
);
assert.equal(
  (
    await c("POST", `/communes/${id}/templates`, {
      ...split,
      id: template.id,
      archived: true,
    })
  ).status,
  403,
);
snap = await get();
assert.equal(snap.splitTemplates[0].participants[1].value, "40");

// The same due period can be confirmed only once, including parallel clicks.
// Month ends: the latest 31st followed by a shorter month whose next period
// is already past, so the bill is recent enough to add and both are due.
const monthEnd = (year, month) => new Date(Date.UTC(year, month + 1, 0));
let anchor = null;
for (let back = 2; !anchor; back += 1) {
  const now = new Date();
  const candidate = monthEnd(now.getUTCFullYear(), now.getUTCMonth() - back);
  const following = monthEnd(now.getUTCFullYear(), now.getUTCMonth() - back + 1);
  if (candidate.getUTCDate() === 31 && following.getUTCDate() < 31) anchor = candidate;
}
const monthPeriod = (offset) =>
  monthEnd(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset)
    .toISOString()
    .slice(0, 10);
const billInput = {
  title: "Monthly utilities",
  amountMinor: 1000,
  paidByUserId: bob.id,
  allocations: [
    { userId: bob.id, amountMinor: 600 },
    { userId: carol.id, amountMinor: 400 },
  ],
  frequency: "monthly",
  nextDueOn: monthPeriod(0),
};
const bill = await a("POST", `/communes/${id}/recurring`, {
  ...billInput,
  paused: false,
  requestId: randomUUID(),
});
assert.equal(bill.status, 201, JSON.stringify(bill));
assert.equal(
  (
    await c("POST", `/recurring/${bill.id}/record`, {
      expectedDueOn: monthPeriod(0),
    })
  ).status,
  403,
);
const simultaneous = await Promise.all([
  a("POST", `/recurring/${bill.id}/record`, { expectedDueOn: monthPeriod(0) }),
  a("POST", `/recurring/${bill.id}/record`, { expectedDueOn: monthPeriod(0) }),
]);
assert.deepEqual(simultaneous.map((item) => item.status).sort(), [201, 409]);
snap = await get();
let rule = snap.recurringBills.find((row) => row.id === bill.id);
assert.equal(rule.nextDueOn, monthPeriod(1));
assert.equal(snap.expenses.filter((row) => row.recurring).length, 1);
assert.equal(
  (
    await b("POST", `/recurring/${bill.id}/record`, {
      expectedDueOn: monthPeriod(1),
    })
  ).status,
  201,
);
snap = await get();
rule = snap.recurringBills.find((row) => row.id === bill.id);
assert.equal(rule.nextDueOn, monthPeriod(2));
assert.equal(
  (await a("POST", `/recurring/${bill.id}/pause`, { paused: true })).status,
  200,
);
assert.equal(
  (
    await a("POST", `/recurring/${bill.id}/record`, {
      expectedDueOn: rule.nextDueOn,
    })
  ).status,
  409,
);
snap = await get();
assert.ok(
  snap.activityEvents.some(
    (event) => event.description === "Contribution corrected",
  ),
);

// Cross-commune entity IDs and lifecycle changes cannot bypass authorization.
const other = await outsider("POST", "/communes", {
  name: "Isolated other commune",
  kind: "trip",
  currency: "EUR",
});
assert.equal(
  (
    await outsider("POST", `/communes/${other.id}/recurring`, {
      ...billInput,
      id: bill.id,
      expectedVersion: rule.version,
      paidByUserId: stranger.id,
      allocations: [{ userId: stranger.id, amountMinor: 1000 }],
    })
  ).status,
  403,
);
assert.equal(
  (
    await outsider("POST", `/communes/${other.id}/templates`, {
      ...split,
      id: template.id,
      participants: [{ userId: stranger.id, value: "100" }],
    })
  ).status,
  403,
);
assert.equal(
  (
    await outsider("POST", `/communes/${id}/members/${alice.id}`, {
      action: "remove",
    })
  ).status,
  403,
);
assert.equal(
  (await a("POST", `/communes/${id}/members/${bob.id}`, { action: "admin" }))
    .status,
  200,
);
assert.equal(
  (await a("POST", `/communes/${id}/members/${alice.id}`, { action: "leave" }))
    .status,
  200,
);
assert.equal((await a("GET", `/communes/${id}/snapshot`)).status, 404);
assert.equal(
  (await a("POST", `/communes/${id}/funds`, { name: "Former admin" })).status,
  403,
);
snap = await b("GET", `/communes/${id}/snapshot`);
assert.equal(
  snap.members.find((member) => member.userId === alice.id).active,
  false,
);
assert.equal(snap.expenses.length, 3);

const timings = [];
for (let i = 0; i < 10; i++) {
  const start = performance.now();
  const result = await b("GET", `/communes/${id}/snapshot`);
  assert.equal(result.status, 200);
  timings.push(performance.now() - start);
}
timings.sort((a, b) => a - b);
console.log(
  `Workflow integration passed: scoped reads, payer permissions, funds, corrections, membership history, templates, recurring idempotency/month-end, reminder cooldowns. Local snapshot median ${timings[5].toFixed(1)}ms; max ${timings[9].toFixed(1)}ms (not a hosted measurement).`,
);
