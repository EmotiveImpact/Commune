import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { createAccount, getUser, login, logout, setSessionCookie, type User } from "./auth.js";
import { pool, withActor } from "./db.js";
import { InvitationEmailError, invitationMailConfig, sendInvitationEmail } from "../../reminder-worker/src/invitations.js";

const host = "127.0.0.1";
const port = Number(process.env.API_PORT ?? "3002");
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const allowedOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("Invalid API_PORT");
}
if (!allowedOrigins.has(appOrigin)) {
  throw new Error("The local API only accepts a loopback APP_ORIGIN");
}

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  res.end(JSON.stringify(value));
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > max) {
    throw new ApiError(400, `Invalid ${field}`);
  }
  return value.trim();
}

function email(value: unknown): string {
  const result = text(value, "email", 254).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(result)) {
    throw new ApiError(400, "Invalid email");
  }
  return result;
}

function uuid(value: unknown, field = "id"): string {
  if (typeof value !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, `Invalid ${field}`);
  }
  return value;
}

function amount(value: unknown, field = "amountMinor"): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) ||
      value <= 0 || value > 1_000_000_000_000) {
    throw new ApiError(400, `Invalid ${field}`);
  }
  return value;
}

function isoDate(value: unknown, optional = false, field = "dueOn"): string | null {
  if ((value === null || value === undefined || value === "") && optional) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `Invalid ${field}`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `Invalid ${field}`);
  }
  return value;
}

function optionalText(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max) {
    throw new ApiError(400, `Invalid ${field}`);
  }
  return value;
}

function locationField(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim().length > max) {
    throw new ApiError(400, `Invalid ${field}`);
  }
  return value.trim();
}

function locationInput(input: Record<string, unknown>) {
  return {
    address: locationField(input.address, "address", 160),
    destination: locationField(input.destination, "destination", 80),
    stayName: locationField(input.stayName, "stayName", 80),
    stayAddress: locationField(input.stayAddress, "stayAddress", 160),
  };
}

function noteInput(input: Record<string, unknown>) {
  if (!Array.isArray(input.facts) || input.facts.length > 30 ||
      !input.facts.every((fact) => Array.isArray(fact) && fact.length === 2 &&
        fact.every((part) => typeof part === "string" && part.length <= 120))) {
    throw new ApiError(400, "Invalid facts");
  }
  return {
    title: text(input.title, "title", 80),
    pill: optionalText(input.pill, "pill", 80),
    kicker: optionalText(input.kicker, "kicker", 120),
    lede: optionalText(input.lede, "lede", 200),
    body: optionalText(input.body, "body", 2000),
    facts: input.facts,
  };
}

// A task or event's fields, checked, in the order create_operation and
// update_operation take them.
function operationArgs(input: Record<string, unknown>) {
  if (input.kind !== "task" && input.kind !== "event") {
    throw new ApiError(400, "Invalid kind");
  }
  if (!["chore", "delivery", "visit", "appointment", "other"].includes(String(input.category))) {
    throw new ApiError(400, "Invalid category");
  }
  if (!["none", "weekly", "monthly"].includes(String(input.repeat))) {
    throw new ApiError(400, "Invalid repeat");
  }
  if (typeof input.allDay !== "boolean") throw new ApiError(400, "Invalid allDay");
  if (input.time != null &&
      (typeof input.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time))) {
    throw new ApiError(400, "Invalid time");
  }
  // People are member ids; the database checks they are current members and
  // copies their names. Status and completion are not part of an add or an
  // edit: only the occurrence commands change them.
  if (input.assigneeId != null && (typeof input.assigneeId !== "string" ||
      !input.assigneeId || input.assigneeId.length > 128)) {
    throw new ApiError(400, "Invalid assigneeId");
  }
  if (input.rotationIds != null && (!Array.isArray(input.rotationIds) ||
      !input.rotationIds.length || input.rotationIds.length > 50 ||
      new Set(input.rotationIds).size !== input.rotationIds.length ||
      !input.rotationIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 128))) {
    throw new ApiError(400, "Invalid rotationIds");
  }
  return [input.kind, input.category, text(input.title, "title", 80), isoDate(input.date, false, "date"),
    input.time ?? null, input.allDay, (input.assigneeId as string | null | undefined) ?? null,
    input.rotationIds == null ? null : JSON.stringify(input.rotationIds), input.repeat,
    optionalText(input.notes, "notes", 1000)];
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!(req.headers["content-type"] ?? "").startsWith("application/json")) {
    throw new ApiError(415, "Expected application/json");
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > 65536) throw new ApiError(413, "Request body is too large");
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch { /* send the same validation error */ }
  throw new ApiError(400, "Invalid JSON object");
}

async function actor(req: IncomingMessage): Promise<User> {
  const user = await getUser(req);
  if (!user) throw new ApiError(401, "Sign in required");
  // Every tab shares one sign-in. A tab names the account it is showing, and
  // nothing is done for anyone else (apps/web/src/live/session.ts).
  const viewer = req.headers["x-commune-viewer"];
  if (typeof viewer === "string" && viewer && viewer !== user.id) {
    throw new ApiError(401, "You signed out or changed account in another tab, so this wasn’t saved.");
  }
  return user;
}

// A bounded local throttle protects password verification from quick guessing.
const failures = new Map<string, { count: number; until: number }>();
function checkThrottle(req: IncomingMessage, address: string): string {
  const key = `${req.socket.remoteAddress ?? "?"}:${address}`;
  const item = failures.get(key);
  if (item && item.until > Date.now() && item.count >= 10) {
    throw new ApiError(429, "Try signing in again later");
  }
  return key;
}
function failed(key: string): void {
  if (failures.size > 1000) failures.clear();
  const existing = failures.get(key);
  failures.set(key, {
    count: existing && existing.until > Date.now() ? existing.count + 1 : 1,
    until: Date.now() + 15 * 60 * 1000,
  });
}

async function listCommunes(user: User) {
  return withActor(user.id, async (client) => {
    const { rows } = await client.query(`
      SELECT c.id, c.name, c.kind, c.currency, c.address,
        c.destination, c.stay_name, c.stay_address, m.role,
        (SELECT count(*)::integer FROM public.commune_members mm
         WHERE mm.commune_id = c.id AND mm.active) AS member_count
      FROM public.communes c
      JOIN public.commune_members m ON m.commune_id = c.id
      WHERE m.user_id = auth.user_id() AND m.active
      ORDER BY c.created_at DESC
    `);
    return { communes: rows.map((row) => ({
      id: row.id, name: row.name, kind: row.kind, currency: row.currency,
      address: row.address, destination: row.destination,
      stayName: row.stay_name, stayAddress: row.stay_address,
      role: row.role, memberCount: row.member_count,
    })) };
  });
}

async function snapshot(user: User, communeId: string) {
  return withActor(user.id, async client => {
    const result = await client.query("SELECT CASE WHEN public.is_commune_member($1) THEN public.commune_snapshot($1) ELSE NULL END AS snapshot", [communeId]);
    if (!result.rows[0].snapshot) throw new ApiError(404,"Commune not found");
    return result.rows[0].snapshot;
  });
}
type Handler = (req: IncomingMessage, res: ServerResponse,
  match: RegExpMatchArray) => Promise<void>;
const routes: { method: string; pattern: RegExp; handle: Handler }[] = [];
function route(method: string, pattern: RegExp, handle: Handler): void {
  routes.push({ method, pattern, handle });
}
const send = (res: ServerResponse, result: unknown, status = 200) => json(res, status, result);
// Create commands take a client request id, so a retry returns the record it
// already created. Older callers without one still work, without retry protection.
const requestIdOf = (input: Record<string, unknown>) =>
  input.requestId == null ? randomUUID() : uuid(input.requestId, "requestId");
const sendCreated = (res: ServerResponse, result: { id: string; duplicate: boolean }) =>
  send(res, { id: result.id, duplicate: result.duplicate }, result.duplicate ? 200 : 201);
const userAction = async <T>(req: IncomingMessage,
  work: (client: PoolClient, user: User) => Promise<T>): Promise<T> => {
  const user = await actor(req);
  return withActor(user.id, (client) => work(client, user));
};

route("GET", /^\/api\/health$/, async (_req, res) => {
  await pool.query("SELECT 1");
  send(res, { ok: true });
});

route("GET", /^\/api\/auth\/me$/, async (req, res) => {
  send(res, { user: await getUser(req) });
});

route("POST", /^\/api\/auth\/signup$/, async (req, res) => {
  const input = await body(req);
  const name = text(input.name, "name", 80);
  const address = email(input.email);
  const password = input.password;
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new ApiError(400, "Password must contain 12–128 characters");
  }
  const key = checkThrottle(req, address);
  try {
    const result = await createAccount(name, address, password);
    failures.delete(key);
    setSessionCookie(res, result.token);
    send(res, { user: result.user }, 201);
  } catch (error) {
    failed(key);
    throw error;
  }
});

route("POST", /^\/api\/auth\/login$/, async (req, res) => {
  const input = await body(req);
  const address = email(input.email);
  if (typeof input.password !== "string" || input.password.length > 128) {
    throw new ApiError(400, "Invalid password");
  }
  const key = checkThrottle(req, address);
  const result = await login(address, input.password);
  if (!result) {
    failed(key);
    throw new ApiError(401, "Invalid email or password");
  }
  failures.delete(key);
  setSessionCookie(res, result.token);
  send(res, { user: result.user });
});

route("POST", /^\/api\/auth\/logout$/, async (req, res) => {
  await logout(req);
  setSessionCookie(res, null);
  send(res, { ok: true });
});

route("GET", /^\/api\/communes$/, async (req, res) => {
  send(res, await listCommunes(await actor(req)));
});

route("GET", /^\/api\/search$/, async (req, res) => {
  const params = new URL(req.url ?? "", "http://127.0.0.1").searchParams;
  const query = (params.get("q") ?? "").trim();
  const communeId = params.has("commune") ? uuid(params.get("commune"), "commune") : null;
  const limit = Number(params.get("limit") ?? 8);
  if (query.length > 80 || !Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new ApiError(400, "Search needs at most 80 characters and a result limit of 1–25");
  }
  const result = await userAction(req, async client => (await client.query(
    "SELECT public.search_commune_records($1,$2,$3) AS result", [query, communeId, limit],
  )).rows[0].result);
  send(res, result);
});

route("POST", /^\/api\/communes$/, async (req, res) => {
  const input = await body(req);
  const name = text(input.name, "name", 48);
  const location = locationInput(input);
  if (!["household", "workspace", "trip"].includes(String(input.kind))) {
    throw new ApiError(400, "Invalid kind");
  }
  const currency = input.currency ?? "GBP";
  if (!["GBP", "USD", "EUR"].includes(String(currency))) {
    throw new ApiError(400, "Invalid currency");
  }
  const id = await userAction(req, async (client) => {
    const result = await client.query(
      "SELECT public.create_commune($1, $2, $3) AS id",
      [name, input.kind, currency]);
    const communeId: string = result.rows[0].id;
    await client.query(
      "SELECT public.update_commune_location($1, $2, $3, $4, $5)",
      [communeId, location.address, location.destination,
        location.stayName, location.stayAddress]);
    return communeId;
  });
  send(res, { id }, 201);
});

route("PATCH", /^\/api\/communes\/([0-9a-f-]{36})$/, async (req, res, match) => {
  const input = await body(req);
  const name = text(input.name, "name", 48);
  const location = locationInput(input);
  if (!["household", "workspace", "trip"].includes(String(input.kind))) {
    throw new ApiError(400, "Invalid kind");
  }
  if (!["GBP", "USD", "EUR"].includes(String(input.currency))) {
    throw new ApiError(400, "Invalid currency");
  }
  await userAction(req, async (client) => {
    const communeId = uuid(match[1]);
    await client.query(
      "SELECT public.update_commune_details($1, $2, $3, $4)",
      [communeId, name, input.kind, input.currency]);
    await client.query(
      "SELECT public.update_commune_location($1, $2, $3, $4, $5)",
      [communeId, location.address, location.destination,
        location.stayName, location.stayAddress]);
  });
  send(res, { ok: true });
});

route("GET", /^\/api\/communes\/([0-9a-f-]{36})\/snapshot$/, async (req, res, match) => {
  send(res, await snapshot(await actor(req), uuid(match[1])));
});

route("GET", /^\/api\/reminders\/usage$/, async (req, res) => {
  const result = await withActor((await actor(req)).id, (client) => client.query(
    "SELECT * FROM public.reminder_usage()"));
  const row = result.rows[0];
  send(res, {
    totalUsed: row.total_used, totalLimit: row.total_limit,
    recipientLimit: row.recipient_limit, recipientUsage: row.recipient_usage,
    nextSlotAt: row.next_slot_at, recipientLastSent: row.recipient_last_sent ?? {},
  });
});

route("POST", /^\/api\/communes\/([0-9a-f-]{36})\/expenses$/, async (req, res, match) => {
  const input = await body(req);
  const communeId = uuid(match[1]);
  const title = text(input.title, "title", 80);
  const amountMinor = amount(input.amountMinor);
  if (!Array.isArray(input.shares) || input.shares.length < 1 || input.shares.length > 100) {
    throw new ApiError(400, "Invalid shares");
  }
  const shares = input.shares.map((item) => {
    if (!item || typeof item !== "object") throw new ApiError(400, "Invalid shares");
    const share = item as Record<string, unknown>;
    return { user_id: uuid(share.userId, "share userId"),
      amount_minor: amount(share.amountMinor, "share amountMinor") };
  });
  const dueOn = isoDate(input.dueOn, true);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.create_expense_command($1, $2, $3, $4::jsonb, $5::date, $6, $7, $8) AS result",
    [communeId, title, amountMinor, JSON.stringify(shares), dueOn, input.paidByUserId == null ? null : uuid(input.paidByUserId), input.category == null ? "Other" : text(input.category,"category",40),
      requestIdOf(input)]));
  sendCreated(res, result.rows[0].result);
});

route("POST", /^\/api\/shares\/([0-9a-f-]{36})\/confirm$/, async (req, res, match) => {
  await body(req);
  await userAction(req, async (client) => client.query(
    "SELECT public.confirm_expense_share($1)", [uuid(match[1])]));
  send(res, { ok: true });
});

function expectedVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ApiError(400, "Invalid expectedVersion");
  }
  return value;
}

// Correction keeps the same expense id and writes a before/after revision.
// expectedVersion is the version the editor loaded; a stale one is a 409.
route("PUT", /^\/api\/expenses\/([0-9a-f-]{36})$/, async (req, res, match) => {
  const input = await body(req);
  if (!Array.isArray(input.shares) || input.shares.length < 1 || input.shares.length > 100) {
    throw new ApiError(400, "Invalid shares");
  }
  const shares = input.shares.map((item) => {
    if (!item || typeof item !== "object") throw new ApiError(400, "Invalid shares");
    const share = item as Record<string, unknown>;
    return { user_id: uuid(share.userId, "share userId"), amount_minor: amount(share.amountMinor, "share amountMinor") };
  });
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.correct_expense($1, $2, $3, $4, $5::jsonb, $6::date, $7, $8, $9, $10) AS result",
    [uuid(match[1]), expectedVersion(input.expectedVersion), text(input.title, "title", 80), amount(input.amountMinor),
      JSON.stringify(shares), isoDate(input.dueOn, true), input.paidByUserId == null ? null : uuid(input.paidByUserId, "paidByUserId"),
      text(input.category, "category", 40), text(input.reason, "reason", 240), uuid(input.requestId, "requestId")]));
  send(res, result.rows[0].result);
});

route("POST", /^\/api\/expenses\/([0-9a-f-]{36})\/void$/, async (req, res, match) => {
  const input = await body(req);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.void_expense($1, $2, $3, $4) AS result",
    [uuid(match[1]), expectedVersion(input.expectedVersion), text(input.reason, "reason", 240), uuid(input.requestId, "requestId")]));
  send(res, result.rows[0].result);
});

// Repayment receipts: the payer records what was received against one share.
// requestId makes a retry return the entry it already created.
route("POST", /^\/api\/shares\/([0-9a-f-]{36})\/receipts$/, async (req, res, match) => {
  const input = await body(req);
  const reference = input.reference == null ? null : optionalText(input.reference, "reference", 80);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.record_share_receipt($1, $2, $3::date, $4, $5) AS result",
    [uuid(match[1]), amount(input.amountMinor), isoDate(input.receivedOn, false, "receivedOn"),
      reference, uuid(input.requestId, "requestId")]));
  const receipt = result.rows[0].result as { duplicate: boolean };
  send(res, receipt, receipt.duplicate ? 200 : 201);
});

route("POST", /^\/api\/receipts\/([0-9a-f-]{36})\/reverse$/, async (req, res, match) => {
  const input = await body(req);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.reverse_share_receipt($1, $2) AS result",
    [uuid(match[1]), text(input.reason, "reason", 240)]));
  send(res, result.rows[0].result);
});

// "I've sent it": the member who owes a share reports a payment. It is a
// claim, not a receipt, until the bill payer confirms it.
route("POST", /^\/api\/shares\/([0-9a-f-]{36})\/payment-reports$/, async (req, res, match) => {
  const input = await body(req);
  const reference = input.reference == null ? null : optionalText(input.reference, "reference", 80);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.report_share_payment($1, $2, $3::date, $4, $5) AS result",
    [uuid(match[1]), amount(input.amountMinor), isoDate(input.sentOn, false, "sentOn"),
      reference, uuid(input.requestId, "requestId")]));
  const report = result.rows[0].result as { duplicate: boolean };
  send(res, report, report.duplicate ? 200 : 201);
});

route("POST", /^\/api\/payment-reports\/([0-9a-f-]{36})\/withdraw$/, async (req, res, match) => {
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.withdraw_share_payment_report($1) AS result", [uuid(match[1])]));
  send(res, result.rows[0].result);
});

route("POST", /^\/api\/payment-reports\/([0-9a-f-]{36})\/resolve$/, async (req, res, match) => {
  const input = await body(req);
  if (input.decision !== "confirm" && input.decision !== "decline") throw new ApiError(400, "Invalid decision");
  const note = input.note == null ? null : optionalText(input.note, "note", 240);
  const requestId = input.decision === "confirm" ? uuid(input.requestId, "requestId") : null;
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.resolve_share_payment_report($1, $2, $3, $4) AS result",
    [uuid(match[1]), input.decision, note, requestId]));
  send(res, result.rows[0].result);
});

// Announcements: an admin posts, members confirm an important one, and the
// author or an admin takes it down. The database checks every rule.
route("POST", /^\/api\/communes\/([0-9a-f-]{36})\/announcements$/, async (req, res, match) => {
  const input = await body(req);
  if (input.body != null && typeof input.body !== "string") throw new ApiError(400, "Invalid body");
  if (typeof input.needsAcknowledgement !== "boolean") throw new ApiError(400, "Invalid needsAcknowledgement");
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.post_announcement($1, $2, $3, $4, $5) AS result",
    [uuid(match[1]), text(input.title, "title", 80), input.body ?? "", input.needsAcknowledgement,
      uuid(input.requestId, "requestId")]));
  const announcement = result.rows[0].result as { duplicate: boolean };
  send(res, announcement, announcement.duplicate ? 200 : 201);
});

route("POST", /^\/api\/announcements\/([0-9a-f-]{36})\/acknowledge$/, async (req, res, match) => {
  await body(req);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.acknowledge_announcement($1) AS result", [uuid(match[1])]));
  send(res, result.rows[0].result);
});

route("POST", /^\/api\/announcements\/([0-9a-f-]{36})\/archive$/, async (req, res, match) => {
  await body(req);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.archive_announcement($1) AS result", [uuid(match[1])]));
  send(res, result.rows[0].result);
});

route("POST", /^\/api\/communes\/([0-9a-f-]{36})\/funds$/, async (req, res, match) => {
  const input = await body(req);
  const name = text(input.name, "name", 80);
  const target = input.targetMinor === undefined || input.targetMinor === null
    ? null : amount(input.targetMinor, "targetMinor");
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.create_fund_command($1, $2, $3, $4) AS result",
    [uuid(match[1]), name, target, requestIdOf(input)]));
  sendCreated(res, result.rows[0].result);
});

route("POST", /^\/api\/funds\/([0-9a-f-]{36})\/pledges$/, async (req, res, match) => {
  const input = await body(req);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.pledge_fund_command($1, $2, $3::date, $4) AS result",
    [uuid(match[1]), amount(input.amountMinor), isoDate(input.dueOn), requestIdOf(input)]));
  sendCreated(res, result.rows[0].result);
});

route("POST", /^\/api\/commitments\/([0-9a-f-]{36})\/contributions$/, async (req, res, match) => {
  const input = await body(req);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.record_fund_contribution_command($1, $2, $3) AS result",
    [uuid(match[1]), amount(input.amountMinor), requestIdOf(input)]));
  sendCreated(res, result.rows[0].result);
});

route("PATCH", /^\/api\/funds\/([0-9a-f-]{36})$/, async (req, res, match) => {
  const input = await body(req);
  await userAction(req, client => client.query("SELECT public.update_fund($1,$2,$3)", [uuid(match[1]),text(input.name,"name",80),input.targetMinor == null ? null : amount(input.targetMinor)]));
  send(res,{ok:true});
});
route("POST", /^\/api\/funds\/([0-9a-f-]{36})\/archive$/, async (req, res, match) => {
  const input = await body(req);
  if (typeof input.archived !== "boolean") throw new ApiError(400,"Invalid archived state");
  await userAction(req, client => client.query("SELECT public.set_fund_archived($1,$2)",[uuid(match[1]),input.archived]));
  send(res,{ok:true});
});
route("PATCH", /^\/api\/commitments\/([0-9a-f-]{36})$/, async (req,res,match) => {
  const input=await body(req);
  if (input.cancel != null && typeof input.cancel !== "boolean") throw new ApiError(400,"Invalid cancellation");
  // The amount and date the editor opened with. If the pledge has changed since, nothing is saved (409).
  const expectedAmount = input.expectedAmountMinor == null ? null : amount(input.expectedAmountMinor, "expectedAmountMinor");
  const expectedDueOn = isoDate(input.expectedDueOn, true, "expectedDueOn");
  await userAction(req,client=>client.query("SELECT public.update_fund_pledge($1,$2,$3::date,$4,$5,$6::date)",[uuid(match[1]),input.cancel === true ? null : amount(input.amountMinor),input.cancel === true ? null : isoDate(input.dueOn),input.cancel === true,expectedAmount,expectedDueOn]));
  send(res,{ok:true});
});
route("POST", /^\/api\/contributions\/([0-9a-f-]{36})\/void$/, async (req,res,match) => {
  const input=await body(req);
  await userAction(req,client=>client.query("SELECT public.void_fund_contribution($1,$2)",[uuid(match[1]),text(input.reason,"reason",240)]));
  send(res,{ok:true});
});
route("POST", /^\/api\/communes\/([0-9a-f-]{36})\/members\/([0-9a-f-]{36})$/, async (req,res,match) => {
  const input=await body(req);
  if (!["admin","member","leave","remove"].includes(String(input.action))) throw new ApiError(400,"Invalid membership action");
  await userAction(req,client=>client.query("SELECT public.manage_commune_member($1,$2,$3)",[uuid(match[1]),uuid(match[2]),input.action]));
  send(res,{ok:true});
});
// Add a bill (requestId makes a retry return the same bill), or edit one from
// the version the editor loaded: a stale expectedVersion is a 409. An edit
// never pauses or resumes; that is /recurring/:id/pause.
route("POST", /^\/api\/communes\/([0-9a-f-]{36})\/recurring$/, async (req,res,match) => {
  const input=await body(req);
  if (!Array.isArray(input.allocations) || input.allocations.length>100 || !["weekly","monthly"].includes(String(input.frequency)) || (input.paused != null && typeof input.paused !== "boolean")) throw new ApiError(400,"Invalid recurring bill");
  const shares=input.allocations.map(value=>{const share=value as Record<string,unknown>; return {user_id:uuid(share?.userId),amount_minor:amount(share?.amountMinor)};});
  const editing=input.id != null;
  const result=await userAction(req,client=>client.query("SELECT public.save_recurring_bill($1,$2,$3,$4,$5::jsonb,$6,$7::date,$8,$9,$10,$11) AS id",[uuid(match[1]),text(input.title,"title",80),amount(input.amountMinor),uuid(input.paidByUserId),JSON.stringify(shares),input.frequency,isoDate(input.nextDueOn),
    editing ? uuid(input.id) : null,editing ? expectedVersion(input.expectedVersion) : null,editing ? null : uuid(input.requestId,"requestId"),input.paused ?? null]));
  send(res,{id:result.rows[0].id},201);
});
// Pause or resume, and archive or restore: each changes only that state and
// is safe to repeat (duplicate: true when the bill was already that way).
route("POST", /^\/api\/recurring\/([0-9a-f-]{36})\/pause$/, async (req,res,match) => {
  const input=await body(req);
  if (typeof input.paused !== "boolean") throw new ApiError(400,"Invalid paused state");
  const result=await userAction(req,client=>client.query("SELECT public.set_recurring_bill_paused($1,$2) AS result",[uuid(match[1]),input.paused]));
  send(res,result.rows[0].result);
});
route("POST", /^\/api\/recurring\/([0-9a-f-]{36})\/archive$/, async (req,res,match) => {
  const input=await body(req);
  if (typeof input.archived !== "boolean") throw new ApiError(400,"Invalid archived state");
  const result=await userAction(req,client=>client.query("SELECT public.set_recurring_bill_archived($1,$2) AS result",[uuid(match[1]),input.archived]));
  send(res,result.rows[0].result);
});
route("POST", /^\/api\/recurring\/([0-9a-f-]{36})\/record$/, async (req,res,match) => {
  const input=await body(req);
  const result=await userAction(req,client=>client.query("SELECT public.record_recurring_bill($1,$2::date) AS id",[uuid(match[1]),isoDate(input.expectedDueOn)]));
  send(res,{id:result.rows[0].id},201);
});
// A recurring bill period: recorded (at the usual or a different amount) or
// skipped with a reason. expectedDueOn names the period, so a retry is safe.
route("POST", /^\/api\/recurring\/([0-9a-f-]{36})\/periods$/, async (req,res,match) => {
  const input=await body(req);
  const amountMinor=input.amountMinor == null ? null : amount(input.amountMinor);
  const result=await userAction(req,client=>client.query("SELECT public.record_recurring_period($1,$2::date,$3) AS result",[uuid(match[1]),isoDate(input.expectedDueOn,false,"expectedDueOn"),amountMinor]));
  const period=result.rows[0].result as {duplicate:boolean};
  send(res,period,period.duplicate ? 200 : 201);
});
route("POST", /^\/api\/recurring\/([0-9a-f-]{36})\/skip$/, async (req,res,match) => {
  const input=await body(req);
  const result=await userAction(req,client=>client.query("SELECT public.skip_recurring_period($1,$2::date,$3) AS result",[uuid(match[1]),isoDate(input.expectedDueOn,false,"expectedDueOn"),text(input.reason,"reason",240)]));
  const period=result.rows[0].result as {duplicate:boolean};
  send(res,period,period.duplicate ? 200 : 201);
});
route("POST", /^\/api\/communes\/([0-9a-f-]{36})\/templates$/, async (req,res,match) => {
  const input=await body(req);
  if (!Array.isArray(input.participants) || input.participants.length>100 || !["Equal","Exact","Percentage","Shares"].includes(String(input.method))) throw new ApiError(400,"Invalid split template");
  if (input.archived != null && typeof input.archived !== "boolean") throw new ApiError(400,"Invalid archived state");
  const participants=input.participants.map(value=>{const item=value as Record<string,unknown>;return {user_id:uuid(item?.userId),value:optionalText(item?.value,"split value",20)};});
  const result=await userAction(req,client=>client.query("SELECT public.save_split_template($1,$2,$3,$4::jsonb,$5,$6) AS id",[uuid(match[1]),text(input.name,"name",60),input.method,JSON.stringify(participants),input.id == null ? null : uuid(input.id),input.archived === true]));
  send(res,{id:result.rows[0].id},201);
});

route("POST", /^\/api\/reminders$/, async (req, res) => {
  const input = await body(req);
  if (input.kind !== "nudge" && input.kind !== "chase") {
    throw new ApiError(400, "Invalid reminder kind");
  }
  // A client-supplied request id makes a retry return the reminder it already
  // created. Older callers without one still work, without retry protection.
  const requestId = input.requestId == null ? randomUUID() : uuid(input.requestId, "requestId");
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.send_local_reminder_command($1, $2, $3) AS result",
    [input.kind, uuid(input.sourceId, "sourceId"), requestId]));
  const reminder = result.rows[0].result as { id: string; duplicate: boolean; emailStatus: string };
  send(res, { id: reminder.id, duplicate: reminder.duplicate, delivery: "in-app",
    emailStatus: reminder.emailStatus, email: "not-configured" }, reminder.duplicate ? 200 : 201);
});

route("POST", /^\/api\/notifications\/([0-9a-f-]{36})\/read$/, async (req, res, match) => {
  await body(req);
  await userAction(req, async (client) => client.query(
    "SELECT public.mark_notification_read($1)", [uuid(match[1])]));
  send(res, { ok: true });
});

// Notes and tasks change only through database commands (migration 0027).
// An add carries requestId, so a retry returns what it already added. An
// edit carries expectedVersion; a stale one is a 409 and nothing is saved.
route("POST", /^\/api\/communes\/([0-9a-f-]{36})\/notes$/, async (req, res, match) => {
  const input = await body(req);
  const card = noteInput(input);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.create_note($1, $2, $3, $4, $5, $6, $7::jsonb, $8) AS result",
    [uuid(match[1]), card.title, card.pill, card.kicker, card.lede, card.body,
      JSON.stringify(card.facts), uuid(input.requestId, "requestId")]));
  const note = result.rows[0].result as { duplicate: boolean };
  send(res, note, note.duplicate ? 200 : 201);
});

route("PUT", /^\/api\/notes\/([0-9a-f-]{36})$/, async (req, res, match) => {
  const input = await body(req);
  const card = noteInput(input);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.update_note($1, $2, $3, $4, $5, $6, $7, $8::jsonb) AS result",
    [uuid(match[1]), expectedVersion(input.expectedVersion), card.title, card.pill, card.kicker,
      card.lede, card.body, JSON.stringify(card.facts)]));
  send(res, result.rows[0].result);
});

route("GET", /^\/api\/notes\/([0-9a-f-]{36})\/revisions\/([0-9a-f-]{36})$/, async (req, res, match) => {
  const result = await userAction(req, async (client) => client.query(`
    SELECT id, version, title, pill, kicker, lede, body, facts, edited_by, edited_at
      FROM public.note_revisions WHERE note_id = $1 AND id = $2
  `, [uuid(match[1]), uuid(match[2])]));
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "Revision not found");
  send(res, { revision: { id: row.id, version: row.version, title: row.title, pill: row.pill, kicker: row.kicker,
    lede: row.lede, body: row.body, facts: row.facts, editedBy: row.edited_by, editedAt: row.edited_at } });
});

// The person who added it or an admin removes a note or task. The record and
// its history are kept, and both leave every view: a removed note's earlier
// versions answer 404 like an unknown one.
route("DELETE", /^\/api\/notes\/([0-9a-f-]{36})$/, async (req, res, match) => {
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.remove_note($1) AS result", [uuid(match[1])]));
  send(res, result.rows[0].result);
});

route("POST", /^\/api\/communes\/([0-9a-f-]{36})\/operations$/, async (req, res, match) => {
  const input = await body(req);
  const item = operationArgs(input);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.create_operation($1, $2, $3, $4, $5::date, $6::time, $7, $8, $9::jsonb, $10, $11, $12) AS result",
    [uuid(match[1]), ...item, uuid(input.requestId, "requestId")]));
  const operation = result.rows[0].result as { duplicate: boolean };
  send(res, operation, operation.duplicate ? 200 : 201);
});

route("PUT", /^\/api\/operations\/([0-9a-f-]{36})$/, async (req, res, match) => {
  const input = await body(req);
  const item = operationArgs(input);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.update_operation($1, $2, $3, $4, $5, $6::date, $7::time, $8, $9, $10::jsonb, $11, $12) AS result",
    [uuid(match[1]), expectedVersion(input.expectedVersion), ...item]));
  send(res, result.rows[0].result);
});

// Completing, skipping or reopening a task is a recorded occurrence. The
// database advances the date and rotation; expectedDate rejects a stale click.
route("POST", /^\/api\/operations\/([0-9a-f-]{36})\/occurrences$/, async (req, res, match) => {
  const input = await body(req);
  if (!["completed", "skipped", "reopened"].includes(String(input.action))) {
    throw new ApiError(400, "Invalid task action");
  }
  if (input.reason != null && typeof input.reason !== "string") throw new ApiError(400, "Invalid reason");
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.record_operation_occurrence($1, $2, $3::date, $4::date, $5, $6) AS result",
    [uuid(match[1]), input.action, isoDate(input.expectedDate, false, "expectedDate"),
      isoDate(input.today, false, "today"), uuid(input.requestId, "requestId"), input.reason ?? null]));
  const occurrence = result.rows[0].result as { duplicate: boolean };
  send(res, occurrence, occurrence.duplicate ? 200 : 201);
});

// Handing the current turn of a task to someone else. On a task that takes
// turns the database remembers whose turn it was, so the rotation carries on
// from them. expectedDate and expectedAssigneeId reject a stale screen.
route("POST", /^\/api\/operations\/([0-9a-f-]{36})\/handovers$/, async (req, res, match) => {
  const input = await body(req);
  if (typeof input.toMemberId !== "string" || !input.toMemberId) throw new ApiError(400, "Choose who takes it");
  if (input.expectedAssigneeId != null && typeof input.expectedAssigneeId !== "string") {
    throw new ApiError(400, "Invalid expectedAssigneeId");
  }
  if (input.reason != null && typeof input.reason !== "string") throw new ApiError(400, "Invalid reason");
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.hand_over_operation($1, $2, $3::date, $4, $5::date, $6, $7) AS result",
    [uuid(match[1]), input.toMemberId, isoDate(input.expectedDate, false, "expectedDate"),
      input.expectedAssigneeId ?? null, isoDate(input.today, false, "today"), input.reason ?? null,
      uuid(input.requestId, "requestId")]));
  const handover = result.rows[0].result as { duplicate: boolean };
  send(res, handover, handover.duplicate ? 200 : 201);
});

route("POST", /^\/api\/occurrences\/([0-9a-f-]{36})\/undo$/, async (req, res, match) => {
  await body(req);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.undo_operation_occurrence($1) AS result", [uuid(match[1])]));
  send(res, result.rows[0].result);
});

route("DELETE", /^\/api\/operations\/([0-9a-f-]{36})$/, async (req, res, match) => {
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.remove_operation($1) AS result", [uuid(match[1])]));
  send(res, result.rows[0].result);
});

route("GET", /^\/api\/communes\/([0-9a-f-]{36})\/invites$/, async (req, res, match) => {
  const result = await userAction(req, async (client) => client.query(
    "SELECT * FROM public.list_commune_invites($1)", [uuid(match[1])]));
  send(res, { invites: result.rows.map((row) => ({
    id: row.id, email: row.email, role: row.role,
    createdAt: row.created_at, expiresAt: row.expires_at,
    acceptedAt: row.accepted_at, revokedAt: row.revoked_at,
    invitedBy: row.invited_by, invitedByName: row.invited_by_name,
  })) });
});

route("POST", /^\/api\/communes\/([0-9a-f-]{36})\/invites$/, async (req, res, match) => {
  const input = await body(req);
  const address = email(input.email);
  const role = input.role ?? "member";
  if (role !== "member" && role !== "admin") throw new ApiError(400, "Invalid role");
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.create_commune_invite($1, $2, $3) AS token",
    [uuid(match[1]), address, role]));
  const token: string = result.rows[0].token;
  send(res, { token, url: `${appOrigin}/invite?token=${token}` }, 201);
});

route("GET", /^\/api\/invites\/([0-9a-f]{64})$/, async (req, res, match) => {
  const result = await userAction(req, async (client) => client.query(
    "SELECT * FROM public.preview_commune_invite($1)", [match[1]]));
  const row = result.rows[0];
  send(res, { invite: row ? {
    communeName: row.commune_name, role: row.role, expiresAt: row.expires_at,
  } : null });
});

route("POST", /^\/api\/invitation-email$/, async (req, res) => {
  const user = await actor(req);
  const input = await body(req);
  try {
    send(res, await sendInvitationEmail(pool, user.id, text(input.token, "token", 64), invitationMailConfig()));
  } catch (error) {
    if (error instanceof InvitationEmailError) throw new ApiError(error.status, error.message);
    throw error;
  }
});

route("POST", /^\/api\/invites\/([0-9a-f]{64})\/accept$/, async (req, res, match) => {
  await body(req);
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.accept_commune_invite($1) AS commune_id", [match[1]]));
  send(res, { communeId: result.rows[0].commune_id });
});

route("POST", /^\/api\/invites\/([0-9a-f-]{36})\/revoke$/, async (req, res, match) => {
  await body(req);
  await userAction(req, async (client) => client.query(
    "SELECT public.revoke_commune_invite($1)", [uuid(match[1])]));
  send(res, { ok: true });
});

route("GET", /^\/api\/preferences$/, async (req, res) => {
  const result = await userAction(req, async (client) => client.query(`
    SELECT email_reminders FROM public.notification_preferences
    WHERE user_id = auth.user_id()
  `));
  send(res, { emailReminders: result.rows[0]?.email_reminders ?? true });
});

route("PUT", /^\/api\/preferences$/, async (req, res) => {
  const input = await body(req);
  if (typeof input.emailReminders !== "boolean") {
    throw new ApiError(400, "Invalid emailReminders");
  }
  const result = await userAction(req, async (client) => client.query(
    "SELECT public.set_email_reminders($1) AS email_reminders", [input.emailReminders]));
  send(res, { emailReminders: result.rows[0].email_reminders });
});

function normalizedError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const postgres = error as { code?: string; message?: string };
  if (postgres.code === "42501") return new ApiError(403, postgres.message ?? "Forbidden");
  if (postgres.code === "22023" || postgres.code === "22P02" || postgres.code === "23514") {
    return new ApiError(400, postgres.message ?? "Invalid request");
  }
  if (postgres.code === "23505" || postgres.code === "P0001") {
    return new ApiError(409, postgres.message ?? "Conflict");
  }
  if (postgres.code === "23503") return new ApiError(400, "Referenced item not found");
  console.error("API error", error);
  return new ApiError(500, "Internal server error");
}

const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? "GET";
    const pathname = new URL(req.url ?? "/", `http://${host}:${port}`).pathname;
    if (!pathname.startsWith("/api/")) throw new ApiError(404, "Not found");
    // The Vite app is same-origin. This rejects cross-site browser writes even
    // if a browser sends a cookie; local curl/tests may omit Origin entirely.
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.has(origin)) {
        throw new ApiError(403, "Cross-origin request rejected");
      }
    }
    const match = routes.find((entry) => entry.method === method && pathname.match(entry.pattern));
    if (!match) throw new ApiError(404, "Not found");
    await match.handle(req, res, pathname.match(match.pattern)!);
  } catch (error) {
    if (!res.headersSent) {
      const safe = normalizedError(error);
      json(res, safe.status, { error: safe.message });
    } else {
      res.end();
    }
  }
});

server.listen(port, host, () => {
  console.log(`Commune local API listening on http://${host}:${port}`);
});

const shutdown = () => {
  server.close(() => void pool.end());
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
