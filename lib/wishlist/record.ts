export type WishlistPriority = "low" | "medium" | "high" | "grail";

export type IgnoredListingState = "none" | "ignored" | "watch_relist";

export type WishlistBuyingControls = {
  priority: WishlistPriority | null;
  tags: string[];
  maxItemPrice: string | null;
  maxShipping: string | null;
  conditionPreference: string | null;
  sellerFilter: string | null;
  regionFilter: string | null;
  ignoredListingState: IgnoredListingState;
  ignoredListingNote: string | null;
  updatedAt: string | null;
};

export type PriceBreakdownFreshness = "fresh" | "aging" | "stale" | "unknown";

export type PriceBreakdownSource =
  | "unknown"
  | "discogs_marketplace_stats";

export type PriceUnknownReason =
  | "legacy_record"
  | "not_checked"
  | "not_available_from_source";

export type ShippingUnknownReason =
  | "legacy_record"
  | "not_checked"
  | "not_supported_by_source";

export type PriceComponent =
  | {
      state: "unknown";
      reason: PriceUnknownReason;
      source: PriceBreakdownSource;
      checkedAt: string | null;
      freshForSeconds: number | null;
    }
  | {
      state: "known";
      amountCents: number;
      currency: string;
      label: string;
      source: "discogs_marketplace_stats";
      checkedAt: string;
      freshForSeconds: number | null;
    };

export type ShippingComponent =
  | {
      state: "unknown";
      reason: ShippingUnknownReason;
      source: "unknown";
      checkedAt: string | null;
      freshForSeconds: number | null;
    }
  | {
      state: "known" | "estimated";
      amountCents: number;
      currency: string;
      label: string;
      source: "provider";
      checkedAt: string | null;
      freshForSeconds: number | null;
    }
  | {
      state: "manual";
      amountCents: number;
      currency: string;
      label: string;
      source: "manual";
      checkedAt: string | null;
      freshForSeconds: number | null;
    };

export type TaxImportComponent = {
  state: "not_calculated";
};

export type PriceBreakdown = {
  itemPrice: PriceComponent;
  shipping: ShippingComponent;
  taxImport: TaxImportComponent;
};

export type EstimatedDeliveredCost =
  | {
      canShow: true;
      reason: null;
      amountCents: number;
      currency: string;
      label: string;
    }
  | {
      canShow: false;
      reason: "item_price_unknown" | "shipping_unknown" | "currency_mismatch";
      amountCents: null;
      currency: null;
      label: string;
    };

export type PriceBreakdownDisplayLine = {
  label: string;
  sourceLabel: string;
  freshness: PriceBreakdownFreshness;
  checkedAt: string | null;
  metaLabel: string;
};

export type LegacyPriceHintDisplay = {
  label: string;
  explanation: string;
};

export type PriceBreakdownDisplay = {
  itemPrice: PriceBreakdownDisplayLine;
  shipping: PriceBreakdownDisplayLine;
  estimatedDeliveredCost: EstimatedDeliveredCost;
  legacyPriceHint: LegacyPriceHintDisplay | null;
  caveats: string[];
};

export type WishlistRecord = {
  id: string;
  savedAt: string;
  spotifyAlbum: string;
  spotifyArtist: string;
  spotifyAlbumId: string | null;
  spotifyAlbumUrl: string | null;
  discogsReleaseId: number;
  discogsTitle: string;
  discogsArtist: string;
  discogsUri: string | null;
  thumb: string | null;
  format: string[];
  year: number | null;
  country: string | null;
  recommendationScore: number;
  confidence: number;
  availabilityLabel: string;
  priceLabel: string;
  sourceTrackCount: number;
  buyingControls: WishlistBuyingControls;
  priceBreakdown: PriceBreakdown;
};

const DEFAULT_BUYING_CONTROLS: WishlistBuyingControls = {
  priority: null,
  tags: [],
  maxItemPrice: null,
  maxShipping: null,
  conditionPreference: null,
  sellerFilter: null,
  regionFilter: null,
  ignoredListingState: "none",
  ignoredListingNote: null,
  updatedAt: null,
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function nullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function nonNegativeInteger(value: unknown) {
  const parsed = nullableInteger(value);

  return parsed !== null && parsed >= 0 ? parsed : null;
}

function nullableTimestamp(value: unknown) {
  const timestamp = nullableString(value);

  if (!timestamp || !ISO_TIMESTAMP_PATTERN.test(timestamp)) {
    return null;
  }

  return Number.isFinite(Date.parse(timestamp)) ? timestamp : null;
}

function nullableFreshForSeconds(value: unknown) {
  const parsed = nullableInteger(value);

  return parsed !== null && parsed >= 0 ? parsed : null;
}

function normalizeCurrency(value: unknown) {
  const currency = nullableString(value)?.toUpperCase() ?? null;

  return currency;
}

function formatMoney(amountCents: number, currency: string) {
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

function stringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizePriority(value: unknown): WishlistPriority | null {
  return value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "grail"
    ? value
    : null;
}

function normalizeIgnoredListingState(value: unknown): IgnoredListingState {
  return value === "ignored" || value === "watch_relist" ? value : "none";
}

function isPriceUnknownReason(value: unknown): value is PriceUnknownReason {
  return (
    value === "legacy_record" ||
    value === "not_checked" ||
    value === "not_available_from_source"
  );
}

function isShippingUnknownReason(value: unknown): value is ShippingUnknownReason {
  return (
    value === "legacy_record" ||
    value === "not_checked" ||
    value === "not_supported_by_source"
  );
}

function isPriceBreakdownSource(value: unknown): value is PriceBreakdownSource {
  return value === "unknown" || value === "discogs_marketplace_stats";
}

function createUnknownPriceComponent(
  reason: PriceUnknownReason,
  source: PriceBreakdownSource = "unknown",
  checkedAt: string | null = null,
  freshForSeconds: number | null = null,
): PriceComponent {
  return {
    state: "unknown",
    reason,
    source,
    checkedAt,
    freshForSeconds,
  };
}

function createUnknownShippingComponent(
  reason: ShippingUnknownReason,
): ShippingComponent {
  return {
    state: "unknown",
    reason,
    source: "unknown",
    checkedAt: null,
    freshForSeconds: null,
  };
}

export function createUnknownPriceBreakdown(
  reason: PriceUnknownReason | ShippingUnknownReason = "legacy_record",
): PriceBreakdown {
  const itemReason: PriceUnknownReason = isPriceUnknownReason(reason)
    ? reason
    : "not_checked";
  const shippingReason: ShippingUnknownReason = isShippingUnknownReason(reason)
    ? reason
    : "not_checked";

  return {
    itemPrice: createUnknownPriceComponent(itemReason),
    shipping: createUnknownShippingComponent(shippingReason),
    taxImport: {
      state: "not_calculated",
    },
  };
}

function normalizePriceComponent(value: unknown): PriceComponent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const component = value as Partial<PriceComponent>;

  if (component.state === "unknown") {
    return createUnknownPriceComponent(
      isPriceUnknownReason(component.reason)
        ? component.reason
        : "legacy_record",
      isPriceBreakdownSource(component.source) ? component.source : "unknown",
      nullableTimestamp(component.checkedAt),
      nullableFreshForSeconds(component.freshForSeconds),
    );
  }

  if (component.state !== "known") {
    return null;
  }

  const amountCents = nonNegativeInteger(component.amountCents);
  const currency = normalizeCurrency(component.currency);
  const checkedAt = nullableTimestamp(component.checkedAt);
  const label = nullableString(component.label);

  if (
    amountCents === null ||
    !currency ||
    !checkedAt ||
    !label ||
    component.source !== "discogs_marketplace_stats"
  ) {
    return null;
  }

  return {
    state: "known",
    amountCents,
    currency,
    label,
    source: "discogs_marketplace_stats",
    checkedAt,
    freshForSeconds: nullableFreshForSeconds(component.freshForSeconds),
  };
}

function normalizeShippingComponent(value: unknown): ShippingComponent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const component = value as Partial<ShippingComponent>;

  if (component.state === "unknown") {
    return createUnknownShippingComponent(
      isShippingUnknownReason(component.reason)
        ? component.reason
        : "legacy_record",
    );
  }

  if (
    component.state !== "known" &&
    component.state !== "estimated" &&
    component.state !== "manual"
  ) {
    return null;
  }

  const amountCents = nonNegativeInteger(component.amountCents);
  const currency = normalizeCurrency(component.currency);
  const label = nullableString(component.label);

  if (amountCents === null || !currency || !label) {
    return null;
  }

  if (
    (component.state === "known" || component.state === "estimated") &&
    component.source !== "provider"
  ) {
    return null;
  }

  if (component.state === "manual" && component.source !== "manual") {
    return null;
  }

  return {
    state: component.state,
    amountCents,
    currency,
    label,
    source: component.source,
    checkedAt: nullableTimestamp(component.checkedAt),
    freshForSeconds: nullableFreshForSeconds(component.freshForSeconds),
  } as ShippingComponent;
}

function normalizePriceBreakdown(value: unknown): PriceBreakdown {
  if (!value || typeof value !== "object") {
    return createUnknownPriceBreakdown("legacy_record");
  }

  const breakdown = value as Partial<PriceBreakdown>;
  const itemPrice = normalizePriceComponent(breakdown.itemPrice);
  const shipping = normalizeShippingComponent(breakdown.shipping);

  if (
    !itemPrice ||
    !shipping ||
    !breakdown.taxImport ||
    breakdown.taxImport.state !== "not_calculated"
  ) {
    return createUnknownPriceBreakdown("legacy_record");
  }

  return {
    itemPrice,
    shipping,
    taxImport: {
      state: "not_calculated",
    },
  };
}

export function createPriceBreakdownFromMarketplaceStats(input: {
  value: number | null;
  currency: string | null;
  label: string | null;
  checkedAt: string | null;
  freshForSeconds: number | null;
}): PriceBreakdown {
  const currency = normalizeCurrency(input.currency);
  const checkedAt = nullableTimestamp(input.checkedAt);
  const label = nullableString(input.label);
  const freshForSeconds = nullableFreshForSeconds(input.freshForSeconds);

  if (typeof input.value !== "number" || !Number.isFinite(input.value)) {
    return {
      itemPrice: createUnknownPriceComponent(
        checkedAt ? "not_available_from_source" : "not_checked",
        checkedAt ? "discogs_marketplace_stats" : "unknown",
        checkedAt,
        freshForSeconds,
      ),
      shipping: createUnknownShippingComponent("not_supported_by_source"),
      taxImport: {
        state: "not_calculated",
      },
    };
  }

  const amountCents = Math.round(input.value * 100);

  if (amountCents < 0 || !currency || !checkedAt) {
    return createUnknownPriceBreakdown("not_checked");
  }

  return {
    itemPrice: {
      state: "known",
      amountCents,
      currency,
      label: label ?? formatMoney(amountCents, currency),
      source: "discogs_marketplace_stats",
      checkedAt,
      freshForSeconds,
    },
    shipping: createUnknownShippingComponent("not_supported_by_source"),
    taxImport: {
      state: "not_calculated",
    },
  };
}

export function getEstimatedDeliveredCost(
  priceBreakdown: PriceBreakdown,
): EstimatedDeliveredCost {
  if (priceBreakdown.itemPrice.state !== "known") {
    return {
      canShow: false,
      reason: "item_price_unknown",
      amountCents: null,
      currency: null,
      label: "Not available because item price is unknown",
    };
  }

  if (priceBreakdown.shipping.state === "unknown") {
    return {
      canShow: false,
      reason: "shipping_unknown",
      amountCents: null,
      currency: null,
      label: "Not available because shipping is unknown",
    };
  }

  if (priceBreakdown.itemPrice.currency !== priceBreakdown.shipping.currency) {
    return {
      canShow: false,
      reason: "currency_mismatch",
      amountCents: null,
      currency: null,
      label:
        "Not available because item price and shipping use different currencies",
    };
  }

  const amountCents =
    priceBreakdown.itemPrice.amountCents + priceBreakdown.shipping.amountCents;

  return {
    canShow: true,
    reason: null,
    amountCents,
    currency: priceBreakdown.itemPrice.currency,
    label: formatMoney(amountCents, priceBreakdown.itemPrice.currency),
  };
}

export function getPriceBreakdownFreshness(
  checkedAt: string | null,
  freshForSeconds: number | null,
  now: Date = new Date(),
): PriceBreakdownFreshness {
  if (!checkedAt || freshForSeconds === null) {
    return "unknown";
  }

  const checkedTime = new Date(checkedAt).getTime();

  if (!Number.isFinite(checkedTime)) {
    return "unknown";
  }

  const ageMs = Math.max(0, now.getTime() - checkedTime);

  if (ageMs <= freshForSeconds * 1000) {
    return "fresh";
  }

  if (ageMs <= DAY_IN_MILLISECONDS) {
    return "aging";
  }

  return "stale";
}

function getPriceSourceLabel(source: PriceBreakdownSource) {
  if (source === "discogs_marketplace_stats") {
    return "Discogs marketplace stats";
  }

  return "Unknown";
}

function getShippingSourceLabel(source: ShippingComponent["source"]) {
  if (source === "provider") {
    return "Provider";
  }

  if (source === "manual") {
    return "Manual";
  }

  return "Unknown";
}

function getPriceBreakdownMetaLabel(line: {
  sourceLabel: string;
  checkedAt: string | null;
  freshness: PriceBreakdownFreshness;
}) {
  if (
    line.sourceLabel === "Unknown" &&
    !line.checkedAt &&
    line.freshness === "unknown"
  ) {
    return "No source or checked time stored";
  }

  const freshnessLabel =
    line.freshness === "fresh"
      ? "Fresh"
      : line.freshness === "aging"
        ? "Aging"
        : line.freshness === "stale"
          ? "Stale"
          : "Unknown";

  return [
    `Source: ${line.sourceLabel}`,
    `Checked: ${line.checkedAt ?? "Unknown"}`,
    `Freshness: ${freshnessLabel}`,
  ].join(" / ");
}

function getItemPriceLabel(itemPrice: PriceComponent) {
  if (itemPrice.state === "known") {
    return itemPrice.label;
  }

  if (itemPrice.source === "discogs_marketplace_stats") {
    return "No marketplace item price available";
  }

  return "No sourced item price stored";
}

function getShippingLabel(shipping: ShippingComponent) {
  if (shipping.state !== "unknown") {
    return shipping.label;
  }

  return "No shipping source stored";
}

function getLegacyPriceHint(
  priceBreakdown: PriceBreakdown,
  legacyPriceLabel: string | null | undefined,
): LegacyPriceHintDisplay | null {
  const label = nullableString(legacyPriceLabel);

  if (
    !label ||
    label.toLowerCase() === "price unknown" ||
    priceBreakdown.itemPrice.state === "known"
  ) {
    return null;
  }

  return {
    label,
    explanation:
      "Not used for estimated delivered cost because source and checked time are unknown.",
  };
}

export function getPriceBreakdownDisplay(
  priceBreakdown: PriceBreakdown,
  now: Date = new Date(),
  options: {
    legacyPriceLabel?: string | null;
  } = {},
): PriceBreakdownDisplay {
  const estimatedDeliveredCost = getEstimatedDeliveredCost(priceBreakdown);
  const itemFreshness = getPriceBreakdownFreshness(
    priceBreakdown.itemPrice.checkedAt,
    priceBreakdown.itemPrice.freshForSeconds,
    now,
  );
  const itemSourceLabel = getPriceSourceLabel(priceBreakdown.itemPrice.source);
  const shippingFreshness = getPriceBreakdownFreshness(
    priceBreakdown.shipping.checkedAt,
    priceBreakdown.shipping.freshForSeconds,
    now,
  );
  const shippingSourceLabel = getShippingSourceLabel(
    priceBreakdown.shipping.source,
  );
  const caveats = [
    "Taxes and import duty are not calculated.",
    "Discogs checkout changes, seller terms, and final cart totals are not included or guaranteed.",
    "Estimated delivered cost is not a guaranteed checkout price.",
  ];

  if (priceBreakdown.shipping.state === "unknown") {
    caveats.push(
      "Shipping is unknown, so WAXLIST cannot show an estimated delivered cost.",
    );
  }

  return {
    itemPrice: {
      label: getItemPriceLabel(priceBreakdown.itemPrice),
      sourceLabel: itemSourceLabel,
      freshness: itemFreshness,
      checkedAt: priceBreakdown.itemPrice.checkedAt,
      metaLabel: getPriceBreakdownMetaLabel({
        sourceLabel: itemSourceLabel,
        checkedAt: priceBreakdown.itemPrice.checkedAt,
        freshness: itemFreshness,
      }),
    },
    shipping: {
      label: getShippingLabel(priceBreakdown.shipping),
      sourceLabel: shippingSourceLabel,
      freshness: shippingFreshness,
      checkedAt: priceBreakdown.shipping.checkedAt,
      metaLabel: getPriceBreakdownMetaLabel({
        sourceLabel: shippingSourceLabel,
        checkedAt: priceBreakdown.shipping.checkedAt,
        freshness: shippingFreshness,
      }),
    },
    estimatedDeliveredCost,
    legacyPriceHint: getLegacyPriceHint(
      priceBreakdown,
      options.legacyPriceLabel,
    ),
    caveats,
  };
}

export function normalizeWishlistBuyingControls(
  value: unknown,
): WishlistBuyingControls {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_BUYING_CONTROLS };
  }

  const controls = value as Partial<WishlistBuyingControls>;

  return {
    priority: normalizePriority(controls.priority),
    tags: stringList(controls.tags),
    maxItemPrice: nullableString(controls.maxItemPrice),
    maxShipping: nullableString(controls.maxShipping),
    conditionPreference: nullableString(controls.conditionPreference),
    sellerFilter: nullableString(controls.sellerFilter),
    regionFilter: nullableString(controls.regionFilter),
    ignoredListingState: normalizeIgnoredListingState(
      controls.ignoredListingState,
    ),
    ignoredListingNote: nullableString(controls.ignoredListingNote),
    updatedAt: nullableString(controls.updatedAt),
  };
}

export function normalizeWishlistRecord(value: unknown): WishlistRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<WishlistRecord>;

  if (
    typeof record.id !== "string" ||
    typeof record.savedAt !== "string" ||
    typeof record.spotifyAlbum !== "string" ||
    typeof record.spotifyArtist !== "string" ||
    typeof record.discogsReleaseId !== "number" ||
    typeof record.discogsTitle !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    savedAt: record.savedAt,
    spotifyAlbum: record.spotifyAlbum,
    spotifyArtist: record.spotifyArtist,
    spotifyAlbumId: nullableString(record.spotifyAlbumId),
    spotifyAlbumUrl: nullableString(record.spotifyAlbumUrl),
    discogsReleaseId: record.discogsReleaseId,
    discogsTitle: record.discogsTitle,
    discogsArtist:
      typeof record.discogsArtist === "string"
        ? record.discogsArtist
        : record.spotifyArtist,
    discogsUri: nullableString(record.discogsUri),
    thumb: nullableString(record.thumb),
    format: Array.isArray(record.format)
      ? record.format.filter(
          (format): format is string => typeof format === "string",
        )
      : [],
    year: nullableNumber(record.year),
    country: nullableString(record.country),
    recommendationScore:
      typeof record.recommendationScore === "number"
        ? record.recommendationScore
        : 0,
    confidence: typeof record.confidence === "number" ? record.confidence : 0,
    availabilityLabel:
      typeof record.availabilityLabel === "string"
        ? record.availabilityLabel
        : "Availability unknown",
    priceLabel:
      typeof record.priceLabel === "string" ? record.priceLabel : "Price unknown",
    sourceTrackCount:
      typeof record.sourceTrackCount === "number" ? record.sourceTrackCount : 0,
    buyingControls: normalizeWishlistBuyingControls(record.buyingControls),
    priceBreakdown: normalizePriceBreakdown(record.priceBreakdown),
  };
}
