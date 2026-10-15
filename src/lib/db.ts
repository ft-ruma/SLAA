import "server-only";
import postgres from "postgres";

// One client per server instance. On Vercel each function instance keeps a
// small pool; Neon's pooler supports startup parameters so the search_path
// is set via the `connection` option. `prepare: false` is required because
// Neon's pooler uses PgBouncer in transaction mode.

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

function createClient() {
  // No connection is opened until the first query, so a missing URL only
  // fails at request time, not during `next build`.
  return postgres(process.env.DATABASE_URL ?? "", {
    max: Number(process.env.DB_POOL_MAX ?? 3),
    idle_timeout: 20,
    prepare: false,
    connection: { search_path: "slaa,public" },
    onnotice: () => {},
  });
}

export const sql: postgres.Sql = globalForDb.sql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
