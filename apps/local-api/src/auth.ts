import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pool } from "./db.js";

const cookieName = "commune_local_session";
const sessionSeconds = 7 * 24 * 60 * 60;
const dummySalt = randomBytes(32);
const dummyHash = randomBytes(64);

export type User = { id: string; name: string; email: string; emailVerified: boolean };

function digest(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

async function passwordHash(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, {
      N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024,
    }, (error, derived) => error ? reject(error) : resolve(derived));
  });
}

function cookieToken(req: IncomingMessage): string | null {
  const item = (req.headers.cookie ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  if (!item) return null;
  const token = item.slice(cookieName.length + 1);
  return /^[0-9a-f]{64}$/.test(token) ? token : null;
}

export function setSessionCookie(res: ServerResponse, token: string | null): void {
  const secure = process.env.APP_ORIGIN?.startsWith("https:") ? "; Secure" : "";
  const value = token ?? "";
  const maxAge = token ? sessionSeconds : 0;
  res.setHeader("Set-Cookie",
    `${cookieName}=${value}; HttpOnly; Path=/api; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

export async function getUser(req: IncomingMessage): Promise<User | null> {
  const token = cookieToken(req);
  if (!token) return null;
  const { rows } = await pool.query<User>(`
    SELECT u.id::text, u.name, u.email, u.email_verified AS "emailVerified"
    FROM app_auth.sessions s JOIN app_auth.users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > now()
  `, [digest(token)]);
  return rows[0] ?? null;
}

export async function createAccount(
  name: string, email: string, password: string,
): Promise<{ user: User; token: string }> {
  const salt = randomBytes(32);
  const hash = await passwordHash(password, salt);
  const token = randomBytes(32).toString("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<User>(`
      INSERT INTO app_auth.users (name, email)
      VALUES ($1, $2) RETURNING id::text, name, email,
        email_verified AS "emailVerified"
    `, [name, email]);
    const user = rows[0];
    await client.query(`
      INSERT INTO app_auth.credentials (user_id, salt, password_hash)
      VALUES ($1, $2, $3)
    `, [user.id, salt, hash]);
    await client.query(`
      INSERT INTO app_auth.sessions (token_hash, user_id, expires_at)
      VALUES ($1, $2, now() + interval '7 days')
    `, [digest(token), user.id]);
    await client.query("COMMIT");
    return { user, token };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function login(
  email: string, password: string,
): Promise<{ user: User; token: string } | null> {
  const { rows } = await pool.query<User & { salt: Buffer; password_hash: Buffer }>(`
    SELECT u.id::text, u.name, u.email,
      u.email_verified AS "emailVerified", c.salt, c.password_hash
    FROM app_auth.users u
    JOIN app_auth.credentials c ON c.user_id = u.id
    WHERE u.email = $1
  `, [email]);
  const record = rows[0];
  const computed = await passwordHash(password, record?.salt ?? dummySalt);
  const expected = record?.password_hash ?? dummyHash;
  if (!record || !timingSafeEqual(computed, expected)) return null;
  const token = randomBytes(32).toString("hex");
  await pool.query(`
    INSERT INTO app_auth.sessions (token_hash, user_id, expires_at)
    VALUES ($1, $2, now() + interval '7 days')
  `, [digest(token), record.id]);
  return {
    user: { id: record.id, name: record.name, email: record.email,
      emailVerified: record.emailVerified }, token,
  };
}

export async function logout(req: IncomingMessage): Promise<void> {
  const token = cookieToken(req);
  if (!token) return;
  await pool.query("DELETE FROM app_auth.sessions WHERE token_hash = $1", [digest(token)]);
}
