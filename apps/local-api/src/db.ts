import { Pool, type PoolClient } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const url = new URL(databaseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
  throw new Error("The local API only accepts a loopback PostgreSQL URL");
}

export const pool = new Pool({ connectionString: databaseUrl, max: 10 });

// Domain reads/writes run as the non-owner role so PostgreSQL RLS and the
// existing SECURITY DEFINER RPC checks apply exactly as they do in Neon.
export async function withActor<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('request.jwt.sub', $1, true)", [userId]);
    await client.query("SET LOCAL ROLE authenticated");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function minor(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Unsafe database amount");
  return number;
}
