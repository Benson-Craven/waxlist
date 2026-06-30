import type {
  DiscogsMarketplaceStats,
  DiscogsSearchCandidate,
  DiscogsSearchResult,
} from "@/lib/discogs/client";
import {
  normalizeForDiscogsSearch,
  type DiscogsSearchUnit,
} from "@/lib/matching/discogs-search-units";

export type RankedDiscogsMatch = DiscogsSearchCandidate & {
  confidence: number;
  confidenceLabel: string;
  recommendationScore: number;
  recommendationLabel: string;
  reasons: string[];
  whyThis: string[];
  availability: {
    status: "available" | "unavailable" | "unknown";
    label: string;
    numForSale: number | null;
  };
  priceHint: {
    label: string;
    value: number | null;
    currency: string | null;
  };
};

export type DiscogsMatchResult = {
  searchUnit: DiscogsSearchUnit;
  matches: RankedDiscogsMatch[];
  bestMatch: RankedDiscogsMatch | null;
  rateLimit: DiscogsSearchResult["rateLimit"];
};

export const RELIABLE_MATCH_CONFIDENCE = 75;

function confidenceLabel(score: number) {
  if (score >= 90) {
    return "Very strong match";
  }

  if (score >= 75) {
    return "Strong match";
  }

  if (score >= 60) {
    return "Possible match";
  }

  return "Weak match";
}

function recommendationLabel(score: number) {
  if (score >= 90) {
    return "Top crate pick";
  }

  if (score >= 75) {
    return "Strong buy signal";
  }

  if (score >= 60) {
    return "Worth reviewing";
  }

  return "Needs manual check";
}

function availabilityFromStats(stats?: DiscogsMarketplaceStats | null) {
  if (!stats || stats.numForSale === null) {
    return {
      status: "unknown" as const,
      label: "Availability unknown",
      numForSale: null,
    };
  }

  if (stats.numForSale > 0) {
    return {
      status: "available" as const,
      label: `${stats.numForSale.toLocaleString()} for sale`,
      numForSale: stats.numForSale,
    };
  }

  return {
    status: "unavailable" as const,
    label: "None for sale",
    numForSale: 0,
  };
}

function priceHintFromStats(stats?: DiscogsMarketplaceStats | null) {
  if (!stats?.lowestPrice) {
    return {
      label: "Price unavailable",
      value: null,
      currency: null,
    };
  }

  return {
    label: `From ${new Intl.NumberFormat("en", {
      style: "currency",
      currency: stats.lowestPrice.currency,
      maximumFractionDigits: 0,
    }).format(stats.lowestPrice.value)}`,
    value: stats.lowestPrice.value,
    currency: stats.lowestPrice.currency,
  };
}

function getPricePracticalityScore(price: number | null) {
  if (price === null) {
    return 4;
  }

  if (price <= 25) {
    return 12;
  }

  if (price <= 45) {
    return 9;
  }

  if (price <= 75) {
    return 6;
  }

  return 2;
}

function scoreRecommendation(input: {
  confidence: number;
  sourceTrackCount: number;
  hasVinylFormat: boolean;
  availabilityStatus: "available" | "unavailable" | "unknown";
  priceValue: number | null;
}) {
  const listeningSignal = Math.min(18, 8 + input.sourceTrackCount * 4);
  const matchSignal = Math.round(input.confidence * 0.46);
  const availabilitySignal =
    input.availabilityStatus === "available"
      ? 16
      : input.availabilityStatus === "unknown"
        ? 6
        : 0;
  const formatSignal = input.hasVinylFormat ? 12 : 3;
  const priceSignal = getPricePracticalityScore(input.priceValue);

  return Math.max(
    0,
    Math.min(
      100,
      listeningSignal +
        matchSignal +
        availabilitySignal +
        formatSignal +
        priceSignal,
    ),
  );
}

function tokenize(value: string) {
  return normalizeForDiscogsSearch(value)
    .split(" ")
    .filter((token) => token.length > 0);
}

function splitDiscogsTitle(title: string) {
  const [artistPart, ...titleParts] = title.split(/\s+-\s+/);

  if (titleParts.length === 0) {
    return {
      artistPart: normalizeForDiscogsSearch(title),
      releasePart: normalizeForDiscogsSearch(title),
      fullTitle: normalizeForDiscogsSearch(title),
      hasSeparator: false,
    };
  }

  return {
    artistPart: normalizeForDiscogsSearch(artistPart),
    releasePart: normalizeForDiscogsSearch(titleParts.join(" - ")),
    fullTitle: normalizeForDiscogsSearch(title),
    hasSeparator: true,
  };
}

function getCoverageScore(input: {
  expected: string;
  actual: string;
  fallbackActual?: string;
}) {
  const expectedTokens = tokenize(input.expected);
  const actualTokens = new Set(tokenize(input.actual));
  const fallbackTokens = new Set(tokenize(input.fallbackActual ?? ""));

  if (expectedTokens.length === 0) {
    return 0;
  }

  const matchedTokens = expectedTokens.filter((token) => actualTokens.has(token));
  const fallbackMatchedTokens = expectedTokens.filter((token) =>
    fallbackTokens.has(token),
  );

  return Math.max(
    matchedTokens.length / expectedTokens.length,
    fallbackMatchedTokens.length / expectedTokens.length,
  );
}

function hasExactPhrase(expected: string, actual: string) {
  const normalizedExpected = normalizeForDiscogsSearch(expected);
  const normalizedActual = normalizeForDiscogsSearch(actual);

  return (
    normalizedExpected.length > 0 &&
    (` ${normalizedActual} `).includes(` ${normalizedExpected} `)
  );
}

function scoreCandidate(unit: DiscogsSearchUnit, candidate: DiscogsSearchCandidate) {
  const titleParts = splitDiscogsTitle(candidate.title);
  const albumCoverage = getCoverageScore({
    expected: unit.album,
    actual: titleParts.releasePart,
    fallbackActual: titleParts.hasSeparator ? undefined : titleParts.fullTitle,
  });
  const artistCoverage = getCoverageScore({
    expected: unit.artist,
    actual: titleParts.artistPart,
    fallbackActual: titleParts.hasSeparator ? undefined : titleParts.fullTitle,
  });
  const albumExact = hasExactPhrase(unit.album, titleParts.releasePart);
  const artistExact = hasExactPhrase(unit.artist, titleParts.artistPart);
  const reasons: string[] = [];
  let score = 10;

  if (albumExact) {
    score += 34;
    reasons.push("Discogs release title matches the Spotify album title.");
  } else if (albumCoverage >= 0.8) {
    score += 22;
    reasons.push("Most Spotify album title tokens match the Discogs release title.");
  } else if (albumCoverage >= 0.5 && tokenize(unit.album).length > 1) {
    score += 10;
    reasons.push("Some Spotify album title tokens match the Discogs release title.");
  }

  if (artistExact) {
    score += 26;
    reasons.push("Discogs artist matches the Spotify artist.");
  } else if (artistCoverage >= 0.8) {
    score += 18;
    reasons.push("Most Spotify artist tokens match the Discogs artist.");
  } else if (artistCoverage >= 0.5 && tokenize(unit.artist).length > 1) {
    score += 8;
    reasons.push("Some Spotify artist tokens match the Discogs artist.");
  }

  if (titleParts.hasSeparator && albumCoverage === 0) {
    score -= 22;
    reasons.push("Spotify album title did not match the Discogs release title.");
  }

  if (titleParts.hasSeparator && artistCoverage === 0) {
    score -= 18;
    reasons.push("Spotify artist did not match the Discogs artist.");
  }

  if (
    candidate.format.some((format) =>
      normalizeForDiscogsSearch(format).includes("vinyl"),
    )
  ) {
    score += 18;
    reasons.push("Discogs result is marked as vinyl.");
  }

  if (unit.releaseYear && candidate.year) {
    const yearDistance = Math.abs(unit.releaseYear - candidate.year);

    if (yearDistance === 0) {
      score += 8;
      reasons.push("Release year matches Spotify metadata.");
    } else if (yearDistance <= 2) {
      score += 4;
      reasons.push("Release year is close to Spotify metadata.");
    }
  }

  if (unit.sourceTrackCount > 1) {
    score += Math.min(8, unit.sourceTrackCount * 2);
    reasons.push("Multiple Spotify source tracks support this album.");
  }

  if (candidate.type !== "release") {
    score -= 10;
  }

  return {
    confidence: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

export function rankDiscogsSearchResult(
  result: DiscogsSearchResult,
  marketplaceStatsByReleaseId: Map<number, DiscogsMarketplaceStats> = new Map(),
): DiscogsMatchResult {
  const matches = result.candidates
    .map((candidate) => {
      const score = scoreCandidate(result.searchUnit, candidate);
      const marketplaceStats = marketplaceStatsByReleaseId.get(candidate.id);
      const availability = availabilityFromStats(marketplaceStats);
      const priceHint = priceHintFromStats(marketplaceStats);
      const hasVinylFormat = candidate.format.some((format) =>
        normalizeForDiscogsSearch(format).includes("vinyl"),
      );
      const recommendationScore = scoreRecommendation({
        confidence: score.confidence,
        sourceTrackCount: result.searchUnit.sourceTrackCount,
        hasVinylFormat,
        availabilityStatus: availability.status,
        priceValue: priceHint.value,
      });
      const whyThis = [
        `${result.searchUnit.sourceTrackCount.toLocaleString()} Spotify source ${
          result.searchUnit.sourceTrackCount === 1 ? "track" : "tracks"
        } pointed to this album.`,
        availability.status === "available"
          ? "Discogs currently reports marketplace copies for this release."
          : availability.status === "unavailable"
            ? "Discogs currently reports no marketplace copies for this release."
            : "Marketplace availability could not be confirmed.",
        priceHint.value !== null
          ? `Lowest listed price hint is ${priceHint.label.toLowerCase()}.`
          : "No Discogs price hint was available.",
      ];

      return {
        ...candidate,
        confidence: score.confidence,
        confidenceLabel: confidenceLabel(score.confidence),
        recommendationScore,
        recommendationLabel: recommendationLabel(recommendationScore),
        reasons:
          score.reasons.length > 0
            ? score.reasons
            : ["Discogs returned this as a low-confidence candidate."],
        whyThis,
        availability,
        priceHint,
      } satisfies RankedDiscogsMatch;
    })
    .sort((first, second) => {
      if (second.recommendationScore !== first.recommendationScore) {
        return second.recommendationScore - first.recommendationScore;
      }

      return second.confidence - first.confidence;
    });

  return {
    searchUnit: result.searchUnit,
    matches,
    bestMatch:
      matches.find((match) => match.confidence >= RELIABLE_MATCH_CONFIDENCE) ??
      null,
    rateLimit: result.rateLimit,
  };
}
