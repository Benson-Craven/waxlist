import type { DiscogsMarketplaceListing } from "@/lib/discogs/client";
import type {
  WishlistBuyingControls,
  WishlistRecord,
} from "@/lib/wishlist/record";

export type SellerScoutShippingEvidence =
  | {
      state: "known";
      amountCents: number;
      currency: string;
      label: string;
      source: "discogs_listing";
    }
  | {
      state: "blocked";
      amountCents: null;
      currency: null;
      label: string;
      source: "discogs_listing";
    }
  | {
      state: "unknown";
      amountCents: null;
      currency: null;
      label: string;
      source: "discogs_listing";
    };

export type SellerScoutListing = {
  listingId: number;
  releaseId: number;
  wantedRecordId: string;
  wantedTitle: string;
  wantedArtist: string;
  priority: WishlistBuyingControls["priority"];
  sellerUsername: string;
  listingUri: string | null;
  status: string | null;
  itemPriceCents: number | null;
  itemPriceCurrency: string | null;
  itemPriceLabel: string;
  shipping: SellerScoutShippingEvidence;
  mediaCondition: string | null;
  sleeveCondition: string | null;
  comments: string | null;
  shipsFrom: string | null;
  sellerTerms: string | null;
  sellerRating: string | null;
  sellerStars: number | null;
  sellerTotalRatings: number | null;
  checkedAt: string;
  freshForSeconds: number | null;
  controlScore: number;
  controlWarnings: string[];
};

export type SellerScoutOpportunity = {
  sellerUsername: string;
  sellerInventoryUri: string | null;
  sellerProfileUri: string | null;
  coverageCount: number;
  listingCount: number;
  score: number;
  itemSubtotal:
    | {
        canShow: true;
        amountCents: number;
        currency: string;
        label: string;
      }
    | {
        canShow: false;
        reason: "missing_item_price" | "currency_mismatch" | "no_listings";
        amountCents: null;
        currency: null;
        label: string;
      };
  shippingSummary: {
    knownCount: number;
    blockedCount: number;
    unknownCount: number;
    label: string;
  };
  shipsFrom: string[];
  sellerRating: string | null;
  sellerStars: number | null;
  sellerTotalRatings: number | null;
  checkedAt: string | null;
  freshForSeconds: number | null;
  reasons: string[];
  listings: SellerScoutListing[];
};

export type SellerScoutReleaseFailure = {
  releaseId: number;
  wantedRecordId: string;
  message: string;
  retryAfterSeconds?: number | null;
};

export type SellerScoutRun = {
  checkedAt: string;
  wantsScanned: number;
  totalWants: number;
  maxWants: number;
  maxListingsPerWant: number;
  truncated: boolean;
  opportunities: SellerScoutOpportunity[];
  singleSellerMatches: SellerScoutOpportunity[];
  failures: SellerScoutReleaseFailure[];
  caveats: string[];
};

export type SellerScoutListingInput = {
  releaseId: number;
  wantedRecord: WishlistRecord;
  listings: DiscogsMarketplaceListing[];
  checkedAt: string;
  freshForSeconds: number | null;
};

const PRIORITY_SCORE: Record<
  NonNullable<WishlistBuyingControls["priority"]>,
  number
> = {
  low: 1,
  medium: 2,
  high: 4,
  grail: 6,
};

function nullableString(value: string | null | undefined) {
  const nextValue = typeof value === "string" ? value.trim() : "";

  return nextValue ? nextValue : null;
}

function normalizeCurrency(value: string | null | undefined) {
  return nullableString(value)?.toUpperCase() ?? null;
}

function normalizeComparableText(value: string | null | undefined) {
  return nullableString(value)?.toLowerCase() ?? null;
}

export function formatSellerScoutMoney(amountCents: number, currency: string) {
  const amount = amountCents / 100;

  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function toAmountCents(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value * 100)
    : null;
}

function createSellerUri(username: string, kind: "profile" | "inventory") {
  const encoded = encodeURIComponent(username);

  return kind === "profile"
    ? `https://www.discogs.com/user/${encoded}`
    : `https://www.discogs.com/seller/${encoded}/profile`;
}

function getPriorityScore(priority: WishlistBuyingControls["priority"]) {
  return priority ? PRIORITY_SCORE[priority] : 0;
}

function parseLooseMoneyCents(value: string | null) {
  const normalized = nullableString(value);

  if (!normalized) {
    return null;
  }

  const match = normalized.replace(/,/g, "").match(/\d+(?:\.\d{1,2})?/);

  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[0]);

  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : null;
}

function textMatchesFilter(value: string | null, filter: string | null) {
  const normalizedValue = normalizeComparableText(value);
  const normalizedFilter = normalizeComparableText(filter);

  return !normalizedFilter || normalizedValue?.includes(normalizedFilter) === true;
}

function parseConditionRank(value: string | null) {
  const normalized = normalizeComparableText(value);

  if (!normalized) {
    return null;
  }

  if (/\b(mint|m)\b/.test(normalized) && !normalized.includes("near")) {
    return 6;
  }

  if (normalized.includes("near mint") || /\bnm\b/.test(normalized)) {
    return 5;
  }

  if (normalized.includes("very good plus") || normalized.includes("vg+")) {
    return 4;
  }

  if (normalized.includes("very good") || /\bvg\b/.test(normalized)) {
    return 3;
  }

  if (normalized.includes("good plus") || normalized.includes("g+")) {
    return 2;
  }

  if (/\bgood\b|\bg\b/.test(normalized)) {
    return 1;
  }

  if (/\bfair\b|\bpoor\b/.test(normalized)) {
    return 0;
  }

  return null;
}

function getConditionPreferenceRank(value: string | null) {
  return parseConditionRank(value);
}

function scoreBuyingControls(input: {
  controls: WishlistBuyingControls;
  sellerUsername: string;
  itemPriceCents: number | null;
  shipping: SellerScoutShippingEvidence;
  mediaCondition: string | null;
  sleeveCondition: string | null;
  shipsFrom: string | null;
  sellerTerms: string | null;
}) {
  let score = Math.min(input.controls.tags.length, 3);
  const warnings: string[] = [];
  const maxItemPriceCents = parseLooseMoneyCents(input.controls.maxItemPrice);
  const maxShippingCents = parseLooseMoneyCents(input.controls.maxShipping);

  if (maxItemPriceCents !== null && input.itemPriceCents !== null) {
    if (input.itemPriceCents <= maxItemPriceCents) {
      score += 6;
    } else {
      score -= 20;
      warnings.push("Above item ceiling");
    }
  }

  if (maxShippingCents !== null && input.shipping.state === "known") {
    if (input.shipping.amountCents <= maxShippingCents) {
      score += 4;
    } else {
      score -= 10;
      warnings.push("Above shipping ceiling");
    }
  }

  if (input.controls.sellerFilter) {
    if (
      textMatchesFilter(input.sellerUsername, input.controls.sellerFilter) ||
      textMatchesFilter(input.sellerTerms, input.controls.sellerFilter)
    ) {
      score += 8;
    } else {
      score -= 12;
      warnings.push("Seller filter not matched");
    }
  }

  if (input.controls.regionFilter) {
    if (textMatchesFilter(input.shipsFrom, input.controls.regionFilter)) {
      score += 6;
    } else {
      score -= 8;
      warnings.push("Region filter not matched");
    }
  }

  if (input.controls.conditionPreference) {
    const minimumRank = getConditionPreferenceRank(
      input.controls.conditionPreference,
    );
    const listingRank = parseConditionRank(input.mediaCondition);

    if (minimumRank !== null && listingRank !== null) {
      if (listingRank >= minimumRank) {
        score += 5;
      } else {
        score -= 6;
        warnings.push("Condition preference not matched");
      }
    } else if (
      textMatchesFilter(input.mediaCondition, input.controls.conditionPreference) ||
      textMatchesFilter(input.sleeveCondition, input.controls.conditionPreference)
    ) {
      score += 3;
    }
  }

  return {
    score,
    warnings,
  };
}

function createShippingEvidence(
  listing: DiscogsMarketplaceListing,
): SellerScoutShippingEvidence {
  if (listing.shippingIsBlocked) {
    return {
      state: "blocked",
      amountCents: null,
      currency: null,
      label: "Shipping blocked by Discogs for this context",
      source: "discogs_listing",
    };
  }

  const amountCents = toAmountCents(listing.shippingPrice?.value ?? null);
  const currency = normalizeCurrency(listing.shippingPrice?.currency ?? null);

  if (amountCents !== null && currency) {
    return {
      state: "known",
      amountCents,
      currency,
      label: formatSellerScoutMoney(amountCents, currency),
      source: "discogs_listing",
    };
  }

  return {
    state: "unknown",
    amountCents: null,
    currency: null,
    label: "Shipping not returned by Discogs",
    source: "discogs_listing",
  };
}

function normalizeListing(
  input: SellerScoutListingInput,
  listing: DiscogsMarketplaceListing,
): SellerScoutListing | null {
  if (!listing.id || !listing.seller?.username) {
    return null;
  }

  const priceCents = toAmountCents(listing.price?.value ?? null);
  const priceCurrency = normalizeCurrency(listing.price?.currency ?? null);
  const shipping = createShippingEvidence(listing);
  const sellerUsername = listing.seller.username;
  const mediaCondition = nullableString(listing.condition);
  const sleeveCondition = nullableString(listing.sleeveCondition);
  const shipsFrom = nullableString(listing.shipsFrom);
  const sellerTerms = nullableString(listing.seller.shipping);
  const controlFit = scoreBuyingControls({
    controls: input.wantedRecord.buyingControls,
    sellerUsername,
    itemPriceCents: priceCents,
    shipping,
    mediaCondition,
    sleeveCondition,
    shipsFrom,
    sellerTerms,
  });

  return {
    listingId: listing.id,
    releaseId: input.releaseId,
    wantedRecordId: input.wantedRecord.id,
    wantedTitle: input.wantedRecord.discogsTitle,
    wantedArtist: input.wantedRecord.discogsArtist,
    priority: input.wantedRecord.buyingControls.priority,
    sellerUsername,
    listingUri: listing.uri,
    status: nullableString(listing.status),
    itemPriceCents: priceCents,
    itemPriceCurrency: priceCurrency,
    itemPriceLabel:
      priceCents !== null && priceCurrency
        ? formatSellerScoutMoney(priceCents, priceCurrency)
        : "Item price unknown",
    shipping,
    mediaCondition,
    sleeveCondition,
    comments: nullableString(listing.comments),
    shipsFrom,
    sellerTerms,
    sellerRating: nullableString(listing.seller.stats?.rating ?? null),
    sellerStars:
      typeof listing.seller.stats?.stars === "number"
        ? listing.seller.stats.stars
        : null,
    sellerTotalRatings:
      typeof listing.seller.stats?.total === "number"
        ? listing.seller.stats.total
        : null,
    checkedAt: input.checkedAt,
    freshForSeconds: input.freshForSeconds,
    controlScore: controlFit.score,
    controlWarnings: controlFit.warnings,
  };
}

function getItemSubtotal(listings: SellerScoutListing[]) {
  const pricedListings = listings.filter(
    (listing) => listing.itemPriceCents !== null && listing.itemPriceCurrency,
  );

  if (listings.length === 0) {
    return {
      canShow: false as const,
      reason: "no_listings" as const,
      amountCents: null,
      currency: null,
      label: "No listings selected",
    };
  }

  if (pricedListings.length !== listings.length) {
    return {
      canShow: false as const,
      reason: "missing_item_price" as const,
      amountCents: null,
      currency: null,
      label: "Subtotal unavailable because item price is missing",
    };
  }

  const currency = pricedListings[0]?.itemPriceCurrency;

  if (!currency || pricedListings.some((listing) => listing.itemPriceCurrency !== currency)) {
    return {
      canShow: false as const,
      reason: "currency_mismatch" as const,
      amountCents: null,
      currency: null,
      label: "Subtotal unavailable across mixed currencies",
    };
  }

  const amountCents = pricedListings.reduce(
    (total, listing) => total + (listing.itemPriceCents ?? 0),
    0,
  );

  return {
    canShow: true as const,
    amountCents,
    currency,
    label: formatSellerScoutMoney(amountCents, currency),
  };
}

function createShippingSummary(listings: SellerScoutListing[]) {
  const knownCount = listings.filter(
    (listing) => listing.shipping.state === "known",
  ).length;
  const blockedCount = listings.filter(
    (listing) => listing.shipping.state === "blocked",
  ).length;
  const unknownCount = listings.filter(
    (listing) => listing.shipping.state === "unknown",
  ).length;

  let label = "Shipping not returned by Discogs";

  if (blockedCount > 0) {
    label = `${blockedCount} listing${blockedCount === 1 ? "" : "s"} blocked for shipping`;
  } else if (knownCount > 0 && unknownCount === 0) {
    label = "Listing-level shipping returned; final bundle shipping still requires Discogs checkout";
  } else if (knownCount > 0) {
    label = "Some listing-level shipping returned; bundle shipping still unknown";
  }

  return {
    knownCount,
    blockedCount,
    unknownCount,
    label,
  };
}

function rankListingsForWantedRecord(listings: SellerScoutListing[]) {
  return [...listings].sort((left, right) => {
    const leftBlocked = left.shipping.state === "blocked" ? 1 : 0;
    const rightBlocked = right.shipping.state === "blocked" ? 1 : 0;

    if (leftBlocked !== rightBlocked) {
      return leftBlocked - rightBlocked;
    }

    if (left.controlScore !== right.controlScore) {
      return right.controlScore - left.controlScore;
    }

    const leftKnownPrice = left.itemPriceCents === null ? 1 : 0;
    const rightKnownPrice = right.itemPriceCents === null ? 1 : 0;

    if (leftKnownPrice !== rightKnownPrice) {
      return leftKnownPrice - rightKnownPrice;
    }

    return (left.itemPriceCents ?? Number.MAX_SAFE_INTEGER) -
      (right.itemPriceCents ?? Number.MAX_SAFE_INTEGER);
  });
}

function buildOpportunity(
  sellerUsername: string,
  listings: SellerScoutListing[],
): SellerScoutOpportunity {
  const bestListingsByWantedRecord = new Map<string, SellerScoutListing>();

  for (const listing of rankListingsForWantedRecord(listings)) {
    if (!bestListingsByWantedRecord.has(listing.wantedRecordId)) {
      bestListingsByWantedRecord.set(listing.wantedRecordId, listing);
    }
  }

  const selectedListings = Array.from(bestListingsByWantedRecord.values());
  const shippingSummary = createShippingSummary(selectedListings);
  const checkedAtValues = selectedListings
    .map((listing) => listing.checkedAt)
    .filter(Boolean)
    .sort();
  const freshForSecondsValues = selectedListings
    .map((listing) => listing.freshForSeconds)
    .filter((value): value is number => typeof value === "number");
  const shipsFrom = Array.from(
    new Set(
      selectedListings
        .map((listing) => listing.shipsFrom)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const priorityScore = selectedListings.reduce(
    (total, listing) => total + getPriorityScore(listing.priority),
    0,
  );
  const score =
    selectedListings.length * 100 +
    priorityScore * 10 +
    selectedListings.reduce((total, listing) => total + listing.controlScore, 0) +
    selectedListings.filter((listing) => listing.itemPriceCents !== null).length * 4 +
    selectedListings.filter((listing) => listing.shipping.state !== "blocked").length * 3 -
    shippingSummary.blockedCount * 20;
  const firstListing = selectedListings[0];
  const reasons = [
    `${selectedListings.length} wanted release${selectedListings.length === 1 ? "" : "s"} covered`,
  ];

  if (priorityScore > 0) {
    reasons.push("Includes prioritized wants");
  }

  if (selectedListings.some((listing) => listing.controlScore > 0)) {
    reasons.push("Matches saved buying controls");
  }

  if (selectedListings.some((listing) => listing.controlWarnings.length > 0)) {
    reasons.push("Some listings conflict with saved controls");
  }

  if (shippingSummary.blockedCount > 0) {
    reasons.push("Some listings are shipping-blocked");
  } else {
    reasons.push("Discogs checkout required for final shipping");
  }

  return {
    sellerUsername,
    sellerInventoryUri: createSellerUri(sellerUsername, "inventory"),
    sellerProfileUri: createSellerUri(sellerUsername, "profile"),
    coverageCount: selectedListings.length,
    listingCount: listings.length,
    score,
    itemSubtotal: getItemSubtotal(selectedListings),
    shippingSummary,
    shipsFrom,
    sellerRating: firstListing?.sellerRating ?? null,
    sellerStars: firstListing?.sellerStars ?? null,
    sellerTotalRatings: firstListing?.sellerTotalRatings ?? null,
    checkedAt: checkedAtValues[0] ?? null,
    freshForSeconds:
      freshForSecondsValues.length > 0
        ? Math.min(...freshForSecondsValues)
        : null,
    reasons,
    listings: selectedListings,
  };
}

function isIgnored(record: WishlistRecord) {
  return record.buyingControls.ignoredListingState === "ignored";
}

function sortWantedRecords(records: WishlistRecord[]) {
  return [...records].sort((left, right) => {
    const priorityDelta =
      getPriorityScore(right.buyingControls.priority) -
      getPriorityScore(left.buyingControls.priority);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const leftAvailable =
      left.availabilityLabel && left.availabilityLabel !== "Availability unknown"
        ? 1
        : 0;
    const rightAvailable =
      right.availabilityLabel && right.availabilityLabel !== "Availability unknown"
        ? 1
        : 0;

    const leftTagged = left.buyingControls.tags.length > 0 ? 1 : 0;
    const rightTagged = right.buyingControls.tags.length > 0 ? 1 : 0;

    if (leftTagged !== rightTagged) {
      return rightTagged - leftTagged;
    }

    if (leftAvailable !== rightAvailable) {
      return rightAvailable - leftAvailable;
    }

    return Date.parse(right.savedAt) - Date.parse(left.savedAt);
  });
}

export function selectSellerScoutWantedRecords(
  records: WishlistRecord[],
  maxWants: number,
) {
  return sortWantedRecords(records.filter((record) => !isIgnored(record))).slice(
    0,
    maxWants,
  );
}

export function buildSellerScoutRun(input: {
  records: WishlistRecord[];
  listingInputs: SellerScoutListingInput[];
  failures?: SellerScoutReleaseFailure[];
  checkedAt: string;
  maxWants: number;
  maxListingsPerWant: number;
}): SellerScoutRun {
  const groupedBySeller = new Map<string, SellerScoutListing[]>();

  for (const listingInput of input.listingInputs) {
    for (const rawListing of listingInput.listings) {
      const listing = normalizeListing(listingInput, rawListing);
      const sellerUsername = rawListing.seller?.username;

      if (!listing || !sellerUsername) {
        continue;
      }

      const sellerListings = groupedBySeller.get(sellerUsername) ?? [];

      sellerListings.push(listing);
      groupedBySeller.set(sellerUsername, sellerListings);
    }
  }

  const opportunities = Array.from(groupedBySeller.entries())
    .map(([sellerUsername, listings]) => buildOpportunity(sellerUsername, listings))
    .sort((left, right) => right.score - left.score || right.coverageCount - left.coverageCount);

  return {
    checkedAt: input.checkedAt,
    wantsScanned: input.listingInputs.length + (input.failures?.length ?? 0),
    totalWants: input.records.filter((record) => !isIgnored(record)).length,
    maxWants: input.maxWants,
    maxListingsPerWant: input.maxListingsPerWant,
    truncated: input.records.filter((record) => !isIgnored(record)).length > input.maxWants,
    opportunities: opportunities.filter(
      (opportunity) => opportunity.coverageCount > 1,
    ),
    singleSellerMatches: opportunities.filter(
      (opportunity) => opportunity.coverageCount === 1,
    ),
    failures: input.failures ?? [],
    caveats: [
      "Shipping is unknown unless Discogs returns explicit listing-level shipping for this context.",
      "Bundle shipping, handling, taxes, and final totals must be confirmed in Discogs checkout.",
      "Seller Scout uses volatile marketplace snapshots and does not reserve listings.",
    ],
  };
}
