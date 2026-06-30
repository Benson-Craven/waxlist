import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseEnv } from "@/lib/config";
import * as schema from "@/lib/db/schema";

type GlobalWithDb = typeof globalThis & {
  waxlistPostgresClient?: postgres.Sql;
};

function getDatabaseUrl() {
  const databaseEnv = getDatabaseEnv();

  if (!databaseEnv.ok) {
    throw new Error(databaseEnv.message);
  }

  return databaseEnv.databaseUrl;
}

const globalForDb = globalThis as GlobalWithDb;

const sql =
  globalForDb.waxlistPostgresClient ??
  postgres(getDatabaseUrl(), {
    max: 5,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.waxlistPostgresClient = sql;
}

export const db = drizzle(sql, { schema });
