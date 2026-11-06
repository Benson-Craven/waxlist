import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { AuthenticatedOwner } from "@/lib/auth/owner";
import {
  normalizePressingEvidence,
  type PressingEvidence,
} from "@/lib/pressing-detective/matching";
import { resolveCataloguePressing } from "@/lib/pressing-proof/server";

export type PressingInvestigationInputSource =
  | "camera_barcode"
  | "manual_barcode"
  | "manual_search"
  | "manual_discogs_id";

type CatalogueAccess = {
  token: string;
  userAgent: string;
  requestDelayMs: number;
  cacheTtlMs: number;
};

export class PressingInvestigationNotFoundError extends Error {
  constructor() {
    super("Pressing investigation not found.");
    this.name = "PressingInvestigationNotFoundError";
  }
}

async function loadDatabase() {
  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);
  return { db, schema };
}

function investigationValues(
  resolution: Awaited<ReturnType<typeof resolveCataloguePressing>>,
  evidence: PressingEvidence,
  now: Date,
) {
  const exact = resolution.resolution.kind === "exact";

  return {
    userEvidence: normalizePressingEvidence(evidence),
    remainingCandidateIds: resolution.resolution.remainingCandidates.map(
      ({ id }) => id,
    ),
    status: exact ? ("resolved" as const) : ("active" as const),
    resolutionKind: resolution.resolution.kind,
    resolvedReleaseId: exact
      ? resolution.resolution.resolvedReleaseId
      : null,
    resolvedAt: exact ? now : null,
    updatedAt: now,
  };
}

export async function listPressingInvestigations(owner: AuthenticatedOwner) {
  const { db, schema } = await loadDatabase();

  return db
    .select()
    .from(schema.pressingInvestigations)
    .where(eq(schema.pressingInvestigations.userId, owner.userId))
    .orderBy(desc(schema.pressingInvestigations.updatedAt));
}

export async function createPressingInvestigation(
  input: CatalogueAccess & {
    owner: AuthenticatedOwner;
    masterId: number | null;
    seedReleaseId: number | null;
    inputSource: PressingInvestigationInputSource;
    evidence: PressingEvidence;
  },
) {
  const resolution = await resolveCataloguePressing({
    masterId: input.masterId,
    seedReleaseId: input.seedReleaseId,
    evidence: input.evidence,
    token: input.token,
    userAgent: input.userAgent,
    requestDelayMs: input.requestDelayMs,
    cacheTtlMs: input.cacheTtlMs,
  });
  const { db, schema } = await loadDatabase();
  const now = new Date();
  const [investigation] = await db
    .insert(schema.pressingInvestigations)
    .values({
      userId: input.owner.userId,
      masterReleaseId: resolution.masterId,
      seedReleaseId: resolution.seedReleaseId,
      inputSource: input.inputSource,
      ...investigationValues(resolution, input.evidence, now),
    })
    .returning();

  if (!investigation) {
    throw new Error("Pressing investigation could not be saved.");
  }

  return {
    ...investigation,
    resolution: resolution.resolution,
    attribution: resolution.attribution,
    checkedAt: resolution.checkedAt,
  };
}

export async function updatePressingInvestigation(
  input: CatalogueAccess & {
    owner: AuthenticatedOwner;
    id: string;
    action: "dismiss" | "resolve";
    evidence?: PressingEvidence;
  },
) {
  const { db, schema } = await loadDatabase();
  const existing = await db.query.pressingInvestigations.findFirst({
    where: and(
      eq(schema.pressingInvestigations.id, input.id),
      eq(schema.pressingInvestigations.userId, input.owner.userId),
    ),
  });

  if (!existing) {
    throw new PressingInvestigationNotFoundError();
  }

  if (input.action === "dismiss") {
    const [dismissed] = await db
      .update(schema.pressingInvestigations)
      .set({
        status: "dismissed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.pressingInvestigations.id, input.id),
          eq(schema.pressingInvestigations.userId, input.owner.userId),
        ),
      )
      .returning();

    if (!dismissed) throw new PressingInvestigationNotFoundError();
    return dismissed;
  }

  const evidencePatch = Object.fromEntries(
    Object.entries(input.evidence ?? {}).filter(([, value]) =>
      typeof value === "number"
        ? Number.isInteger(value)
        : typeof value === "string" && value.trim().length > 0,
    ),
  ) as PressingEvidence;
  const evidence = normalizePressingEvidence({
    ...(existing.userEvidence ?? {}),
    ...evidencePatch,
  });
  const resolution = await resolveCataloguePressing({
    masterId: existing.masterReleaseId,
    seedReleaseId: existing.seedReleaseId,
    evidence,
    token: input.token,
    userAgent: input.userAgent,
    requestDelayMs: input.requestDelayMs,
    cacheTtlMs: input.cacheTtlMs,
  });
  const [updated] = await db
    .update(schema.pressingInvestigations)
    .set(investigationValues(resolution, evidence, new Date()))
    .where(
      and(
        eq(schema.pressingInvestigations.id, input.id),
        eq(schema.pressingInvestigations.userId, input.owner.userId),
      ),
    )
    .returning();

  if (!updated) throw new PressingInvestigationNotFoundError();

  return {
    ...updated,
    resolution: resolution.resolution,
    attribution: resolution.attribution,
    checkedAt: resolution.checkedAt,
  };
}
