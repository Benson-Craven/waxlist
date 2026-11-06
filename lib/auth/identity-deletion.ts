import "server-only";

import { sql } from "drizzle-orm";

export async function deleteAuthIdentityById(authUserId: string) {
  const { db } = await import("@/lib/db/client");
  const deletedRows = await db.execute(sql`
    delete from neon_auth."user"
    where id::text = ${authUserId}
    returning id
  `);

  return deletedRows.length > 0;
}
