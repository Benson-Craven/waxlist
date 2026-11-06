import "server-only";

import { eq } from "drizzle-orm";

import { getNeonAuthSession } from "@/lib/auth/server";

export type AuthenticatedOwner = {
  type: "user";
  userId: string;
  authUserId: string;
  sessionIdHash: null;
};

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);

  return { db, schema };
}

export async function resolveAuthenticatedOwner(): Promise<
  | {
      ok: true;
      owner: AuthenticatedOwner;
      profile: {
        id: string;
        displayName: string | null;
        email: string | null;
        imageUrl: string | null;
      };
    }
  | {
      ok: false;
      code:
        | "auth_configuration_error"
        | "auth_session_error"
        | "auth_required";
      message: string;
      missing: string[];
    }
> {
  const session = await getNeonAuthSession();

  if (!session.ok) {
    return session;
  }

  let user: { id: string } | undefined;

  try {
    const { db, schema } = await loadDatabase();
    const now = new Date();
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.authUserId, session.user.id),
      columns: {
        id: true,
      },
    });

    user =
      existing ??
      (
        await db
          .insert(schema.users)
          .values({
            authUserId: session.user.id,
            spotifyUserId: null,
            displayName: session.user.name,
            imageUrl: session.user.image,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.users.authUserId,
            set: {
              displayName: session.user.name,
              imageUrl: session.user.image,
              updatedAt: now,
            },
          })
          .returning({
            id: schema.users.id,
          })
      )[0];
  } catch {
    // A database outage must not render a server error in the workspace; the
    // sign-in surface explains the retry instead.
    return {
      ok: false,
      code: "auth_session_error",
      message: "WAXLIST could not resolve the signed-in account.",
      missing: [],
    };
  }

  if (!user) {
    return {
      ok: false,
      code: "auth_session_error",
      message: "WAXLIST could not resolve the signed-in account.",
      missing: [],
    };
  }

  return {
    ok: true,
    owner: {
      type: "user",
      userId: user.id,
      authUserId: session.user.id,
      sessionIdHash: null,
    },
    profile: {
      id: session.user.id,
      displayName: session.user.name,
      email: session.user.email,
      imageUrl: session.user.image,
    },
  };
}
