import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { is } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import postgres from "postgres";

import * as schema from "../lib/db/schema.ts";
import { findColumnDrift, neonEndpoint } from "../lib/db/diagnostics.ts";

nextEnv.loadEnvConfig(process.cwd());

async function checkDatabase() {
  const context = JSON.parse(await readFile(".neon", "utf8"));
  const branch = context.branch ?? context.branchId;
  if (!context.projectId || !branch) {
    throw new Error(
      "Select the app's project and branch in .neon before checking the database.",
    );
  }
  const database = new URL(process.env.DATABASE_URL ?? "");
  const auth = new URL(process.env.NEON_AUTH_BASE_URL ?? "");
  const endpoint = neonEndpoint(database.hostname);
  const authEndpoint = neonEndpoint(auth.hostname);
  if (endpoint && authEndpoint && endpoint !== authEndpoint) {
    throw new Error(
      "DATABASE_URL and NEON_AUTH_BASE_URL target different Neon endpoints.",
    );
  }
  if (
    endpoint && authEndpoint &&
    database.pathname.split("/")[1] !== auth.pathname.split("/")[1]
  ) {
    throw new Error(
      "DATABASE_URL and NEON_AUTH_BASE_URL target different databases.",
    );
  }

  console.log(`Pinned Neon branch: ${branch}`);
  console.log(`Database endpoint: ${database.hostname}`);
  console.log(`Database name: ${database.pathname.slice(1)}`);
  console.log(
    "The connection comes from DATABASE_URL. The .neon pin controls CLI tooling only.",
  );

  const expectedColumns = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .flatMap((table) => {
      const config = getTableConfig(table);
      return config.columns.map((column) => ({
        table: config.name,
        name: column.name,
        type: column.getSQLType(),
        notNull: column.notNull,
      }));
    });
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
  const latest = migrations.at(-1);
  const sql = postgres(database.toString(), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
  });
  try {
    await sql.begin("read only", async (transaction) => {
      await transaction`SET LOCAL statement_timeout = '10s'`;
      const actualColumns = await transaction`
        SELECT c.relname AS "table", a.attname AS name,
          format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS "notNull"
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND a.attnum > 0 AND NOT a.attisdropped
      `;
      const problems = findColumnDrift(expectedColumns, actualColumns);
      const [applied] = await transaction`
        SELECT hash, created_at FROM drizzle.__drizzle_migrations
        ORDER BY created_at DESC LIMIT 1
      `;
      if (
        !latest || Number(applied?.created_at) !== latest.folderMillis ||
        applied?.hash !== latest.hash
      ) {
        problems.push(
          "The database migration head differs from this checkout. Review pending migrations on this branch.",
        );
      }
      if (problems.length) throw new Error(problems.join("\n"));
      console.log(
        `Checked ${expectedColumns.length} app columns and the latest migration hash. No drift found.`,
      );
      console.log(
        "Indexes, constraints, historical migration gaps, and data differences between branches are not compared.",
      );
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

checkDatabase().catch((error) => {
  // Provider errors can contain SQL parameters or connection details.
  if (error?.code) {
    console.error(`Database check failed with code ${error.code}.`);
  } else if (error instanceof TypeError) {
    console.error("DATABASE_URL and NEON_AUTH_BASE_URL must be valid URLs.");
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});
