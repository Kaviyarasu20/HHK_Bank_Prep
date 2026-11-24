// server/db.js
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

/**
 * Builds PostgreSQL SSL configuration from environment variables.
 * - DATABASE_SSL=false (or unset in development): disables SSL for local dev compatibility.
 * - DATABASE_SSL=true / require / 1: enables SSL with certificate verification ON by default.
 * - Reject-unauthorized is NEVER disabled in production unless explicitly opted into via
 *   DATABASE_SSL_REJECT_UNAUTHORIZED=false outside production (blocked in production).
 */
export function buildDatabaseSslConfig(env = process.env) {
  const rawSsl = String(env.DATABASE_SSL ?? "").trim().toLowerCase();
  const isProduction = String(env.NODE_ENV ?? "").trim().toLowerCase() === "production";

  if (!rawSsl || rawSsl === "false" || rawSsl === "0" || rawSsl === "off" || rawSsl === "disable") {
    return false;
  }

  if (["true", "1", "on", "require", "verify-full", "verify-ca"].includes(rawSsl)) {
    const rawReject = String(env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? "true").trim().toLowerCase();
    const rejectUnauthorized = isProduction ? true : rawReject !== "false";
    const sslConfig = { rejectUnauthorized };
    if (env.DATABASE_SSL_CA) {
      sslConfig.ca = String(env.DATABASE_SSL_CA).replace(/\\n/g, "\n");
    }
    return sslConfig;
  }

  throw new Error(
    `Invalid DATABASE_SSL value "${rawSsl}". Expected "true", "false", or "require".`,
  );
}

/**
 * Builds a validated pg.Pool configuration without hardcoded fallback credentials.
 */
export function buildDatabasePoolConfig(env = process.env) {
  const ssl = buildDatabaseSslConfig(env);
  const connectionString = String(env.DATABASE_URL ?? "").trim();

  if (connectionString) {
    return { connectionString, ssl };
  }

  const host = env.PGHOST || env.DB_HOST;
  const port = Number(env.PGPORT || env.DB_PORT || 5432);
  const user = env.PGUSER || env.DB_USER;
  const password = env.PGPASSWORD || env.DB_PASSWORD;
  const database = env.PGDATABASE || env.DB_NAME;

  if (!host || !user || !password || !database) {
    throw new Error(
      "Database configuration missing: set DATABASE_URL (or PGHOST, PGUSER, PGPASSWORD, PGDATABASE) in your environment.",
    );
  }

  return { host, port, user, password, database, ssl };
}

export const pool = new Pool(buildDatabasePoolConfig(process.env));

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export default pool;