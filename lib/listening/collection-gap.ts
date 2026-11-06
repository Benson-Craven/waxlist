import { RELIABLE_MATCH_CONFIDENCE } from "@/lib/matching/match-discogs-release";
import type { CollectionGapState } from "@/lib/listening/types";

type CollectionIdentity = {
  status: "owned" | "wanted";
  discogsReleaseId: number;
  discogsMasterId: number | null;
};

function belongsToMatchedAlbum(
  item: CollectionIdentity,
  match: {
    releaseId: number;
    masterId: number | null;
  },
) {
  if (match.masterId !== null) {
    return item.discogsMasterId === match.masterId;
  }

  return item.discogsReleaseId === match.releaseId;
}

export function classifyCollectionGap(input: {
  candidateMetadataQuality: "complete" | "review";
  match: {
    confidence: number;
    releaseId: number;
    masterId: number | null;
  } | null;
  collection: CollectionIdentity[];
}): CollectionGapState {
  if (input.candidateMetadataQuality === "review") {
    return "review";
  }

  if (!input.match) {
    return "unmatched";
  }

  if (input.match.confidence < RELIABLE_MATCH_CONFIDENCE) {
    return "review";
  }

  const sameAlbumItems = input.collection.filter((item) =>
    belongsToMatchedAlbum(item, input.match!),
  );

  if (sameAlbumItems.some((item) => item.status === "owned")) {
    return "owned";
  }

  if (sameAlbumItems.some((item) => item.status === "wanted")) {
    return "wanted";
  }

  return "missing";
}
