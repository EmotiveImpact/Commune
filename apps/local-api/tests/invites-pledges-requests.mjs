import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Migration 0028: invitations end when their sender stops being an admin,
// only the pledger can raise a pledge or bring it forward, and new expenses,
// funds, pledges and contributions are retry-safe on a request id.
// Creates accounts and records, so it refuses the normal application API.
const base = process.env.API_BASE;
if (!base) throw new Error("Set API_BASE to an isolated local test API, not the user's database.");
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !url.port ||
    url.port === "3002" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("Invite, pledge and request tests require an isolated loopback API port (not 3002).");
}
const suffix = randomUUID().slice(0, 8);
const password = "DisposableInvitePledgeFixture-2026!";
function session() {
  let cookie = "";
  return async (method, path, input) => {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { ...(input === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: response.status, ...(await response.json()) };
  };
}
const ok = (result, status = 200) => { assert.equal(result.status, status, JSON.stringify(result)); return result; };
const avery = session(), blake = session(), casey = session(), drew = session();
const users = [];
for (const [index, call] of [avery, blake, casey, drew].entries()) {
  users.push(ok(await call("POST", "/auth/signup", {
    name: ["Avery Owner", "Blake Admin", "Casey Member", "Drew Newcomer"][index],
    email: `invites-pledges-${index}-${suffix}@example.test`, password,
  }), 201).user);
}
const [averyUser, blakeUser, caseyUser, drewUser] = users;
const id = ok(await avery("POST", "/communes", { name: `Invites and pledges ${suffix}`, kind: "household", currency: "GBP" }), 201).id;
for (const [user, call, role] of [[blakeUser, blake, "admin"], [caseyUser, casey, "member"]]) {
  const invite = ok(await avery("POST", `/communes/${id}/invites`, { email: user.email, role }), 201);
  assert.equal(ok(await call("POST", `/invites/${invite.token}/accept`, {})).communeId, id);
}
const snapshot = async (call = avery) => ok(await call("GET", `/communes/${id}/snapshot`));
const invites = async () => ok(await avery("GET", `/communes/${id}/invites`)).invites;
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The database's own wording for a date in a notice. */
const noticeDay = (iso) => `${Number(iso.slice(8, 10))} ${months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

// ------------------------------------------------- invitations and their sender
{
  const fromBlake = ok(await blake("POST", `/communes/${id}/invites`, { email: drewUser.email, role: "admin" }), 201);
  let list = await invites();
  const sent = list.find(item => item.email === drewUser.email);
  assert.deepEqual([sent.invitedBy, sent.invitedByName, sent.revokedAt], [blakeUser.id, "Blake Admin", null]);
  const accepted = list.find(item => item.email === caseyUser.email);
  assert.deepEqual([accepted.invitedBy, accepted.invitedByName], [averyUser.id, "Avery Owner"]);
  assert.equal((await casey("GET", `/communes/${id}/invites`)).status, 403);

  // Removing Blake withdraws the admin invitation Blake sent, so it cannot be
  // used to come back in.
  ok(await avery("POST", `/communes/${id}/members/${blakeUser.id}`, { action: "remove" }));
  list = await invites();
  assert.ok(list.find(item => item.id === sent.id).revokedAt);
  assert.equal(ok(await drew("GET", `/invites/${fromBlake.token}`)).invite, null);
  assert.equal((await drew("POST", `/invites/${fromBlake.token}/accept`, {})).status, 403);
  assert.equal((await drew("GET", `/communes/${id}/snapshot`)).status, 404);

  // A demotion withdraws the invitations the former admin sent.
  ok(await avery("POST", `/communes/${id}/members/${caseyUser.id}`, { action: "admin" }));
  const later = `later-${suffix}@example.test`;
  ok(await casey("POST", `/communes/${id}/invites`, { email: later, role: "member" }), 201);
  ok(await avery("POST", `/communes/${id}/members/${caseyUser.id}`, { action: "member" }));
  assert.ok((await invites()).find(item => item.email === later).revokedAt);

  // An invitation from a current admin still works.
  const fromAvery = ok(await avery("POST", `/communes/${id}/invites`, { email: drewUser.email, role: "member" }), 201);
  assert.equal(ok(await drew("POST", `/invites/${fromAvery.token}/accept`, {})).communeId, id);
}

// ------------------------------------------------- retry-safe creates
let fund, pledge;
{
  const path = `/communes/${id}/expenses`;
  const expense = { title: "Groceries", amountMinor: 3000, requestId: randomUUID(),
    shares: [{ userId: averyUser.id, amountMinor: 1500 }, { userId: caseyUser.id, amountMinor: 1500 }] };
  // Two attempts at once, as after a dropped connection: one records, one replays.
  const pair = await Promise.all([avery("POST", path, expense), avery("POST", path, expense)]);
  assert.deepEqual(pair.map(item => item.status).sort(), [200, 201]);
  assert.deepEqual(pair.map(item => item.duplicate).sort(), [false, true]);
  assert.equal(pair[0].id, pair[1].id);
  const again = ok(await avery("POST", path, expense));
  assert.deepEqual([again.id, again.duplicate], [pair[0].id, true]);
  assert.equal((await snapshot()).expenses.filter(item => item.title === "Groceries").length, 1);
  const reused = await avery("POST", path, { ...expense, title: "Groceries and wine" });
  assert.deepEqual([reused.status, reused.error], [400, "This request was already used for a different change"]);
  // The same id from someone else is their own request.
  const own = ok(await casey("POST", path, { ...expense, shares: [{ userId: caseyUser.id, amountMinor: 3000 }] }), 201);
  assert.notEqual(own.id, pair[0].id);

  const fundInput = { name: "Boiler fund", targetMinor: 50000, requestId: randomUUID() };
  fund = ok(await avery("POST", `/communes/${id}/funds`, fundInput), 201);
  assert.deepEqual(ok(await avery("POST", `/communes/${id}/funds`, fundInput)), { status: 200, id: fund.id, duplicate: true });
  assert.equal((await avery("POST", `/communes/${id}/funds`, { ...fundInput, targetMinor: 60000 })).status, 400);

  const pledgeInput = { amountMinor: 10000, dueOn: day(20), requestId: randomUUID() };
  pledge = ok(await casey("POST", `/funds/${fund.id}/pledges`, pledgeInput), 201);
  assert.deepEqual(ok(await casey("POST", `/funds/${fund.id}/pledges`, pledgeInput)), { status: 200, id: pledge.id, duplicate: true });
  assert.equal((await casey("POST", `/funds/${fund.id}/pledges`, { ...pledgeInput, amountMinor: 9000 })).status, 400);
  // A new request for a second pledge is refused, not added.
  assert.equal((await casey("POST", `/funds/${fund.id}/pledges`, { ...pledgeInput, requestId: randomUUID() })).status, 409);

  const contributionInput = { amountMinor: 2000, requestId: randomUUID() };
  const contribution = ok(await avery("POST", `/commitments/${pledge.id}/contributions`, contributionInput), 201);
  assert.deepEqual(ok(await avery("POST", `/commitments/${pledge.id}/contributions`, contributionInput)),
    { status: 200, id: contribution.id, duplicate: true });
  assert.equal((await avery("POST", `/commitments/${pledge.id}/contributions`, { ...contributionInput, amountMinor: 2500 })).status, 400);

  const funds = (await snapshot()).funds;
  assert.equal(funds.filter(item => item.name === "Boiler fund").length, 1);
  const stored = funds.find(item => item.id === fund.id).commitments.filter(item => item.userId === caseyUser.id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].contributedMinor, 2000);
  assert.equal(stored[0].contributions.length, 1);
}

// ------------------------------------------------- pledges stay with the pledger
{
  const change = (call, input) => call("PATCH", `/commitments/${pledge.id}`, input);
  const raised = await change(avery, { amountMinor: 12000, dueOn: day(20) });
  assert.deepEqual([raised.status, raised.error], [403, "Only the person who made this pledge can raise it or bring its due date forward"]);
  assert.equal((await change(avery, { amountMinor: 10000, dueOn: day(10) })).status, 403);
  assert.equal((await change(avery, { amountMinor: 1000, dueOn: day(20) })).status, 400);
  assert.equal((await snapshot(casey)).notifications.filter(item => item.kind.startsWith("pledge-")).length, 0);

  ok(await change(avery, { amountMinor: 8000, dueOn: day(30) }));
  let notices = (await snapshot(casey)).notifications.filter(item => item.kind === "pledge-changed");
  assert.equal(notices.length, 1);
  assert.deepEqual([notices[0].sourceId, notices[0].senderUserId, notices[0].amountMinor, notices[0].title],
    [pledge.id, averyUser.id, 8000, "Boiler fund"]);
  assert.equal(notices[0].detail,
    `Lowered from £100.00 to £80.00. Due date moved from ${noticeDay(day(20))} to ${noticeDay(day(30))}.`);

  // The pledger may raise it and bring it forward, and is not told about their own change.
  ok(await change(casey, { amountMinor: 12000, dueOn: day(5) }));
  notices = (await snapshot(casey)).notifications.filter(item => item.kind === "pledge-changed");
  assert.equal(notices.length, 1);
  const stored = (await snapshot()).funds.find(item => item.id === fund.id).commitments.find(item => item.id === pledge.id);
  assert.deepEqual([stored.amountMinor, stored.dueOn], [12000, day(5)]);

  // Cancelling someone's pledge tells them once, even if the request repeats.
  const drewPledge = ok(await drew("POST", `/funds/${fund.id}/pledges`, { amountMinor: 3000, dueOn: day(15), requestId: randomUUID() }), 201);
  ok(await avery("PATCH", `/commitments/${drewPledge.id}`, { cancel: true }));
  ok(await avery("PATCH", `/commitments/${drewPledge.id}`, { cancel: true }));
  const cancelled = (await snapshot(drew)).notifications.filter(item => item.kind.startsWith("pledge-"));
  assert.deepEqual(cancelled.map(item => [item.kind, item.sourceId, item.amountMinor, item.senderUserId]),
    [["pledge-cancelled", drewPledge.id, 3000, averyUser.id]]);
  assert.equal((await snapshot()).notifications.filter(item => item.kind.startsWith("pledge-")).length, 0);
}
// ------------------------------------------------- a change based on an older pledge
{
  // Casey's pledge is now £120.00 due day(5). A change made from a screen that
  // still showed £100.00 due day(20) would undo Casey's raise, so it saves nothing.
  const change = (call, input) => call("PATCH", `/commitments/${pledge.id}`, input);
  const changed = "This pledge changed while you were editing. Nothing was saved. Check it again.";
  const notices = async () => (await snapshot(casey)).notifications.filter(item => item.kind.startsWith("pledge-"));
  const before = (await notices()).length;
  for (const [call, input] of [
    [avery, { amountMinor: 9000, dueOn: day(20), expectedAmountMinor: 10000, expectedDueOn: day(20) }],
    [avery, { amountMinor: 9000, dueOn: day(5), expectedAmountMinor: 12000, expectedDueOn: day(20) }],
    [casey, { amountMinor: 15000, dueOn: day(5), expectedAmountMinor: 10000, expectedDueOn: day(5) }],
  ]) {
    const stale = await change(call, input);
    assert.deepEqual([stale.status, stale.error], [409, changed]);
  }
  assert.equal((await change(avery, { amountMinor: 9000, dueOn: day(5), expectedAmountMinor: "120.00" })).status, 400);
  let stored = (await snapshot()).funds.find(item => item.id === fund.id).commitments.find(item => item.id === pledge.id);
  assert.deepEqual([stored.amountMinor, stored.dueOn], [12000, day(5)]);
  assert.equal((await notices()).length, before);

  // Based on the pledge as it is, the same change is saved and Casey is told.
  ok(await change(avery, { amountMinor: 9000, dueOn: day(5), expectedAmountMinor: 12000, expectedDueOn: day(5) }));
  stored = (await snapshot()).funds.find(item => item.id === fund.id).commitments.find(item => item.id === pledge.id);
  assert.deepEqual([stored.amountMinor, stored.dueOn], [9000, day(5)]);
  assert.ok((await notices()).some(item => item.detail === "Lowered from £120.00 to £90.00."));
}

// ------------------------------------------------- a pledge made again
{
  const garden = ok(await avery("POST", `/communes/${id}/funds`, { name: "Garden fund", targetMinor: null, requestId: randomUUID() }), 201);
  const path = `/funds/${garden.id}/pledges`;
  const reused = "This request was already used for a different change";
  const first = { amountMinor: 2000, dueOn: day(30), requestId: randomUUID() };
  const second = { amountMinor: 2500, dueOn: day(40), requestId: randomUUID() };
  const made = ok(await casey("POST", path, first), 201);
  ok(await casey("PATCH", `/commitments/${made.id}`, { cancel: true }));
  assert.equal(ok(await casey("POST", path, second), 201).id, made.id);

  // The first request no longer describes the pledge: repeating it is refused
  // as a reused request, not reported as saved or as a second pledge.
  let retry = await casey("POST", path, first);
  assert.deepEqual([retry.status, retry.error], [400, reused]);
  assert.deepEqual(ok(await casey("POST", path, second)), { status: 200, id: made.id, duplicate: true });
  // A cancellation based on the first pledge is refused too.
  retry = await avery("PATCH", `/commitments/${made.id}`, { cancel: true, expectedAmountMinor: 2000, expectedDueOn: day(30) });
  assert.deepEqual([retry.status, retry.error], [409, "This pledge changed while you were editing. Nothing was saved. Check it again."]);

  // Once cancelled again, neither request brings the pledge back.
  ok(await casey("PATCH", `/commitments/${made.id}`, { cancel: true, expectedAmountMinor: 2500, expectedDueOn: day(40) }));
  for (const input of [first, second]) {
    retry = await casey("POST", path, input);
    assert.deepEqual([retry.status, retry.error], [400, reused]);
  }
  const stored = (await snapshot()).funds.find(item => item.id === garden.id).commitments;
  assert.equal(stored.length, 1);
  assert.ok(stored[0].cancelledAt);
  assert.deepEqual([stored[0].amountMinor, stored[0].dueOn], [2500, day(40)]);
}
console.log(`invite, pledge and request integration passed (${base})`);
