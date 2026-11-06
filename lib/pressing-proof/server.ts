import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { AuthenticatedOwner } from "@/lib/auth/owner";
import {
  getDiscogsCatalogueMasterVersions,
  getDiscogsCatalogueRelease,
  searchDiscogsPressings,
  type DiscogsCatalogueRateLimit,
  type DiscogsPressingSearchQuery,
  type DiscogsPressingSeed,
} from "@/lib/discogs/catalogue-client";
import {
  rankPressingCandidates,
  type PressingCandidate,
  type PressingEvidence,
} from "@/lib/pressing-detective/matching";
import { resolvePressingCandidates } from "@/lib/pressing-proof/resolution";

const MAX_VERSION_CANDIDATES = 25;
const MAX_DETAIL_CANDIDATES = 12;

export class PressingCatalogueInputError extends Error {
  constructor(
    public readonly code:
      | "pressing_family_mismatch"
      | "pressing_family_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "PressingCatalogueInputError";
  }
}

type CatalogueAccess = {
  token: string;
  userAgent: string;
  requestDelayMs: number;
  cacheTtlMs: number;
};

function emptyRateLimit(): DiscogsCatalogueRateLimit {
  return {
    limit: null,
    used: null,
    remaining: null,
  };
}

function mergeRateLimit(
  current: DiscogsCatalogueRateLimit,
  next: DiscogsCatalogueRateLimit,
) {
  return {
    limit: next.limit ?? current.limit,
    used: next.used ?? current.used,
    remaining:
      current.remaining === null
        ? next.remaining
        : next.remaining === null
          ? current.remaining
          : Math.min(current.remaining, next.remaining),
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function seedFromCandidate(candidate: PressingCandidate): DiscogsPressingSeed {
  return {
    id: candidate.id,
    masterId: candidate.masterId,
    title: candidate.title,
    year: candidate.year,
    formats: candidate.formats,
    country: candidate.country,
    labels: candidate.labels,
    catalogNumbers: candidate.catalogNumbers,
    barcodes: candidate.barcodes,
    uri:
      candidate.uri ?? `https://www.discogs.com/release/${candidate.id}`,
  };
}

export async function searchPressingSeeds(
  input: CatalogueAccess & {
    query: DiscogsPressingSearchQuery;
    releaseId?: number | null;
  },
) {
  if (input.releaseId) {
    const result = await getDiscogsCatalogueRelease({
      releaseId: input.releaseId,
      token: input.token,
      userAgent: input.userAgent,
      cacheTtlMs: input.cacheTtlMs,
    });

    return {
      candidates: [seedFromCandidate(result.candidate)],
      totalItems: 1,
      rateLimit: result.rateLimit,
      checkedAt: result.checkedAt,
      attribution: result.attribution,
    };
  }

  return searchDiscogsPressings({
    query: input.query,
    token: input.token,
    userAgent: input.userAgent,
    cacheTtlMs: input.cacheTtlMs,
  });
}

export async function resolveCataloguePressing(
  input: CatalogueAccess & {
    masterId?: number | null;
    seedReleaseId?: number | null;
    evidence: PressingEvidence;
  },
) {
  let masterId = input.masterId ?? null;
  let seedCandidate: PressingCandidate | null = null;
  let rateLimit = emptyRateLimit();
  let checkedAt = new Date().toISOString();
  let attribution = {
    label: "Catalogue data provided by Discogs",
    url: "https://www.discogs.com",
  };

  if (input.seedReleaseId) {
    const seedResult = await getDiscogsCatalogueRelease({
      releaseId: input.seedReleaseId,
      token: input.token,
      userAgent: input.userAgent,
      cacheTtlMs: input.cacheTtlMs,
    });
    seedCandidate = seedResult.candidate;
    if (
      masterId !== null &&
      seedCandidate.masterId !== masterId
    ) {
      throw new PressingCatalogueInputError(
        "pressing_family_mismatch",
        "The selected Discogs release does not belong to the supplied master family.",
      );
    }
    masterId = seedCandidate.masterId;
    rateLimit = mergeRateLimit(rateLimit, seedResult.rateLimit);
    checkedAt = seedResult.checkedAt;
    attribution = seedResult.attribution;
  }

  if (!masterId && seedCandidate) {
    const resolution = resolvePressingCandidates({
      candidates: [seedCandidate],
      evidence: input.evidence,
      context: {
        totalCandidates: 2,
        returnedCandidates: 1,
        truncated: true,
        failedCandidateIds: [],
      },
    });

    return {
      masterId: null,
      familyKey: `release:${seedCandidate.id}`,
      seedReleaseId: input.seedReleaseId ?? seedCandidate.id,
      resolution,
      checkedAt,
      attribution,
      rateLimit,
    };
  }

  if (!masterId) {
    throw new PressingCatalogueInputError(
      "pressing_family_unavailable",
      "Choose a Discogs release or master family before checking evidence.",
    );
  }

  const versionsResult = await getDiscogsCatalogueMasterVersions({
    masterId,
    page: 1,
    perPage: MAX_VERSION_CANDIDATES,
    token: input.token,
    userAgent: input.userAgent,
    cacheTtlMs: input.cacheTtlMs,
  });
  rateLimit = mergeRateLimit(rateLimit, versionsResult.rateLimit);
  checkedAt = versionsResult.checkedAt;
  attribution = versionsResult.attribution;

  const preliminaryCandidates = [...versionsResult.versions];
  if (
    seedCandidate &&
    !preliminaryCandidates.some(({ id }) => id === seedCandidate?.id)
  ) {
    preliminaryCandidates.unshift(seedCandidate);
  }
  const ranked = rankPressingCandidates(
    preliminaryCandidates,
    input.evidence,
  );
  const detailIds = new Set(
    ranked.slice(0, MAX_DETAIL_CANDIDATES).map(({ id }) => id),
  );
  if (seedCandidate) {
    detailIds.add(seedCandidate.id);
  }

  const detailedCandidates = new Map<number, PressingCandidate>();
  if (seedCandidate) {
    detailedCandidates.set(seedCandidate.id, seedCandidate);
  }
  const failedCandidateIds: number[] = [];

  for (const [index, releaseId] of Array.from(detailIds).entries()) {
    if (detailedCandidates.has(releaseId)) {
      continue;
    }

    if (index > 0 && input.requestDelayMs > 0) {
      await wait(input.requestDelayMs);
    }

    try {
      const result = await getDiscogsCatalogueRelease({
        releaseId,
        token: input.token,
        userAgent: input.userAgent,
        cacheTtlMs: input.cacheTtlMs,
      });
      detailedCandidates.set(releaseId, result.candidate);
      rateLimit = mergeRateLimit(rateLimit, result.rateLimit);
      checkedAt = result.checkedAt;
    } catch {
      failedCandidateIds.push(releaseId);
    }
  }

  const candidates = preliminaryCandidates.map(
    (candidate) => detailedCandidates.get(candidate.id) ?? candidate,
  );
  for (const candidate of candidates) {
    if (!candidate.detailLoaded && !failedCandidateIds.includes(candidate.id)) {
      failedCandidateIds.push(candidate.id);
    }
  }
  const truncated = versionsResult.totalItems > versionsResult.versions.length;
  const resolution = resolvePressingCandidates({
    candidates,
    evidence: input.evidence,
    context: {
      totalCandidates: versionsResult.totalItems,
      returnedCandidates: versionsResult.versions.length,
      truncated,
      failedCandidateIds,
    },
  });

  return {
    masterId,
    familyKey: `master:${masterId}`,
    seedReleaseId: input.seedReleaseId ?? null,
    resolution,
    checkedAt,
    attribution,
    rateLimit,
  };
}

export async function loadPressingCollectionOverlay(
  owner: AuthenticatedOwner,
  releaseIds: number[],
) {
  const uniqueReleaseIds = Array.from(
    new Set(releaseIds.filter((id) => Number.isInteger(id) && id > 0)),
  );

  if (uniqueReleaseIds.length === 0) {
    return [];
  }

  const [{ db }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ]);
  const records = await db
    .select({
      releaseId: schema.collectionItems.discogsReleaseId,
      status: schema.collectionItems.status,
    })
    .from(schema.collectionItems)
    .where(
      and(
        eq(schema.collectionItems.userId, owner.userId),
        inArray(schema.collectionItems.discogsReleaseId, uniqueReleaseIds),
      ),
    );

  return uniqueReleaseIds.map((releaseId) => {
    const matches = records.filter((record) => record.releaseId === releaseId);
    const ownedCount = matches.filter(
      (record) => record.status === "owned",
    ).length;

    return {
      releaseId,
      owned: ownedCount > 0,
      wanted: matches.some((record) => record.status === "wanted"),
      duplicateCount: ownedCount,
    };
  });
}
