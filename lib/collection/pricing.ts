import type {
  CollectionItemStatus,
  CollectionRecord,
} from "@/lib/collection/record";

/**
 * A dated observation of what one collection record is worth. Snapshots are
 * recorded when the collector saves a value by hand and when a marketplace
 * refresh succeeds. The Dashboard graph and every price movement are built from
 * this history, never from an inferred trend.
 */
export type CollectionPriceSource = "manual" | "discogs_marketplace";

export type CollectionPriceSnapshot = {
  id: string;
  collectionItemId: string;
  discogsReleaseId: number;
  amountCents: number;
  currency: string;
  source: CollectionPriceSource;
  observedAt: string;
};

export type RecordPriceSummary = {
  currentCents: number;
  currency: string;
  source: CollectionPriceSource;
  observedAt: string;
  previousCents: number | null;
  changeCents: number | null;
  changePercent: number | null;
};

export type CollectionValuePoint = {
  date: string;
  amountCents: number;
};

export type CollectionPriceDirection = "drop" | "same" | "increase";

/**
 * One vinyl's latest recorded value and the move from its previous check. Every
 * valued vinyl gets an entry, owned or wanted, because the Dashboard price
 * overview is about the whole shelf and its shortlist, not just owned value.
 */
export type CollectionPriceMovement = {
  collectionItemId: string;
  discogsReleaseId: number;
  artist: string;
  title: string;
  imageUrl: string | null;
  status: CollectionItemStatus;
  currency: string;
  currentCents: number;
  previousCents: number | null;
  changeCents: number | null;
  changePercent: number | null;
  observedAt: string;
  direction: CollectionPriceDirection;
};

export type CollectionPricingMovements = {
  drops: CollectionPriceMovement[];
  same: CollectionPriceMovement[];
  increases: CollectionPriceMovement[];
};

export type CollectionPricingSummary = {
  currency: string;
  totalCents: number;
  pricedCount: number;
  unpricedCount: number;
  ownedPricedCount: number;
  wantedPricedCount: number;
  otherCurrencyCount: number;
  /** Sum of the latest move per record; negative means tracked vinyls fell. */
  changeCents: number | null;
  changePercent: number | null;
  periodDays: number;
  lastObservedAt: string | null;
  series: CollectionValuePoint[];
  /** Every valued vinyl, split by its last recorded move. */
  movements: CollectionPricingMovements;
};

export type SummarizeCollectionPricingOptions = {
  now?: Date;
  windowDays?: number;
};

export const DEFAULT_PRICING_WINDOW_DAYS = 90;
export const SUPPORTED_PRICE_CURRENCIES = [
  "GBP",
  "USD",
  "EUR",
  "CAD",
  "AUD",
  "JPY",
] as const;

const DAY_MS = 86_400_000;
const MAX_PRICE_INPUT = 1_000_000;
const MAX_SERIES_POINTS = 120;

export function normalizePriceCurrency(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const currency = value.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

export function isSupportedPriceCurrency(value: unknown): value is string {
  const currency = normalizePriceCurrency(value);

  return Boolean(
    currency &&
      (SUPPORTED_PRICE_CURRENCIES as readonly string[]).includes(currency),
  );
}

function priceFormatter(currency: string, fractionDigits: number) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  } catch {
    return null;
  }
}

/**
 * Money is stored as integer cents. Whole amounts drop the decimals so the
 * dashboard reads as a value, not a bank statement.
 */
export function formatPriceCents(
  amountCents: number,
  currency: string,
): string {
  const normalizedCurrency = normalizePriceCurrency(currency) ?? "GBP";
  const safeCents = Number.isFinite(amountCents) ? Math.round(amountCents) : 0;
  const fractionDigits = safeCents % 100 === 0 ? 0 : 2;
  const formatter = priceFormatter(normalizedCurrency, fractionDigits);

  if (formatter) {
    return formatter.format(safeCents / 100);
  }

  return `${(safeCents / 100).toFixed(fractionDigits)} ${normalizedCurrency}`;
}

export function formatPriceInput(amountCents: number): string {
  return (amountCents / 100).toFixed(2).replace(/\.00$/, "");
}

export function formatPriceDate(value: string | null, now: Date = new Date()) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const format: Intl.DateTimeFormatOptions =
    date.getUTCFullYear() === now.getUTCFullYear()
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" };

  return new Intl.DateTimeFormat("en-GB", { ...format, timeZone: "UTC" }).format(
    date,
  );
}

export function normalizeCollectionPriceInput(
  value: unknown,
): { amountCents: number; currency: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    amountCents?: unknown;
    currency?: unknown;
  };
  const amountCents = Number(record.amountCents);
  const currency = normalizePriceCurrency(record.currency);

  if (
    !Number.isInteger(amountCents) ||
    amountCents <= 0 ||
    amountCents > MAX_PRICE_INPUT * 100 ||
    !currency
  ) {
    return null;
  }

  return { amountCents, currency };
}

export function parsePriceToCents(value: string): number | null {
  const normalized = value.replace(/[£$€,\s]/g, "");

  if (!normalized || !/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_PRICE_INPUT) {
    return null;
  }

  const cents = Math.round(amount * 100);

  return cents > 0 ? cents : null;
}

function snapshotTime(snapshot: CollectionPriceSnapshot) {
  return new Date(snapshot.observedAt).getTime();
}

function isUsableSnapshot(snapshot: CollectionPriceSnapshot) {
  return (
    Number.isInteger(snapshot.amountCents) &&
    snapshot.amountCents > 0 &&
    Boolean(normalizePriceCurrency(snapshot.currency)) &&
    Number.isFinite(snapshotTime(snapshot))
  );
}

function compareSnapshotsAscending(
  left: CollectionPriceSnapshot,
  right: CollectionPriceSnapshot,
) {
  return snapshotTime(left) - snapshotTime(right);
}

function percentChange(changeCents: number, previousCents: number) {
  if (previousCents <= 0) {
    return null;
  }

  return (changeCents / previousCents) * 100;
}

function groupSnapshotsByItem(snapshots: CollectionPriceSnapshot[]) {
  const grouped = new Map<string, CollectionPriceSnapshot[]>();

  for (const snapshot of snapshots) {
    if (!isUsableSnapshot(snapshot)) {
      continue;
    }

    const current = grouped.get(snapshot.collectionItemId) ?? [];
    current.push(snapshot);
    grouped.set(snapshot.collectionItemId, current);
  }

  for (const points of grouped.values()) {
    points.sort(compareSnapshotsAscending);
  }

  return grouped;
}

/**
 * The latest value and its move from the previous observation. Snapshots in
 * other currencies are ignored so a value is never compared across currencies.
 */
export function getRecordPriceSummary(
  snapshots: CollectionPriceSnapshot[],
): RecordPriceSummary | null {
  const usable = snapshots.filter(isUsableSnapshot).sort(compareSnapshotsAscending);
  const latest = usable.at(-1);

  if (!latest) {
    return null;
  }

  const currency = normalizePriceCurrency(latest.currency);

  if (!currency) {
    return null;
  }

  const sameCurrency = usable.filter(
    (snapshot) => normalizePriceCurrency(snapshot.currency) === currency,
  );
  const previous = sameCurrency.at(-2) ?? null;
  const changeCents = previous ? latest.amountCents - previous.amountCents : null;

  return {
    currentCents: latest.amountCents,
    currency,
    source: latest.source,
    observedAt: latest.observedAt,
    previousCents: previous?.amountCents ?? null,
    changeCents,
    changePercent:
      previous && changeCents !== null
        ? percentChange(changeCents, previous.amountCents)
        : null,
  };
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dominantCurrency(
  records: CollectionRecord[],
  grouped: Map<string, CollectionPriceSnapshot[]>,
) {
  const counts = new Map<string, number>();

  for (const record of records) {
    const latest = grouped.get(record.id)?.at(-1);
    const currency = normalizePriceCurrency(latest?.currency);

    if (currency) {
      counts.set(currency, (counts.get(currency) ?? 0) + 1);
    }
  }

  return (
    [...counts.entries()].sort(
      ([leftCurrency, leftCount], [rightCurrency, rightCount]) =>
        rightCount - leftCount || leftCurrency.localeCompare(rightCurrency),
    )[0]?.[0] ?? null
  );
}

function buildValueSeries(input: {
  records: CollectionRecord[];
  grouped: Map<string, CollectionPriceSnapshot[]>;
  currency: string;
  now: Date;
  windowDays: number;
}): CollectionValuePoint[] {
  const { records, grouped, currency, now, windowDays } = input;
  const windowStart = startOfUtcDay(
    new Date(now.getTime() - (windowDays - 1) * DAY_MS),
  );
  const todayStart = startOfUtcDay(now);
  const pointsByRecord = new Map<string, CollectionPriceSnapshot[]>();

  for (const record of records) {
    const points = (grouped.get(record.id) ?? []).filter(
      (snapshot) =>
        normalizePriceCurrency(snapshot.currency) === currency &&
        snapshotTime(snapshot) <= now.getTime(),
    );

    if (points.length > 0) {
      pointsByRecord.set(record.id, points);
    }
  }

  if (pointsByRecord.size === 0) {
    return [];
  }

  const earliest = Math.min(
    ...[...pointsByRecord.values()].map((points) => snapshotTime(points[0])),
  );
  const firstDay = Math.max(windowStart.getTime(), startOfUtcDay(new Date(earliest)).getTime());
  const series: CollectionValuePoint[] = [];

  for (
    let day = firstDay;
    day <= todayStart.getTime();
    day += DAY_MS
  ) {
    const endOfDay = day + DAY_MS - 1;
    let totalCents = 0;
    let hasValue = false;

    for (const points of pointsByRecord.values()) {
      let value: number | null = null;

      for (const point of points) {
        if (snapshotTime(point) > endOfDay) {
          break;
        }

        value = point.amountCents;
      }

      if (value !== null) {
        totalCents += value;
        hasValue = true;
      }
    }

    if (hasValue) {
      series.push({ date: isoDay(new Date(day)), amountCents: totalCents });
    }
  }

  if (series.length <= MAX_SERIES_POINTS) {
    return series;
  }

  // Downsample only when a long window would otherwise crowd the chart. The
  // most recent point is always kept so the line ends at today's value.
  const step = Math.ceil(series.length / MAX_SERIES_POINTS);
  const sampled = series.filter((_, index) => index % step === 0);

  if (sampled.at(-1) !== series.at(-1)) {
    sampled.push(series.at(-1)!);
  }

  return sampled;
}

type PricedEntry = {
  record: CollectionRecord;
  currentCents: number;
  previousCents: number | null;
  observedAt: string;
};

function toMovement(
  entry: PricedEntry,
  currency: string,
): CollectionPriceMovement {
  const changeCents =
    entry.previousCents === null
      ? null
      : entry.currentCents - entry.previousCents;
  const direction: CollectionPriceDirection =
    changeCents === null || changeCents === 0
      ? "same"
      : changeCents < 0
        ? "drop"
        : "increase";

  return {
    collectionItemId: entry.record.id,
    discogsReleaseId: entry.record.discogsReleaseId,
    artist: entry.record.artist,
    title: entry.record.title,
    imageUrl: entry.record.imageUrl,
    status: entry.record.status,
    currency,
    currentCents: entry.currentCents,
    previousCents: entry.previousCents,
    changeCents,
    changePercent:
      changeCents !== null && entry.previousCents !== null
        ? percentChange(changeCents, entry.previousCents)
        : null,
    observedAt: entry.observedAt,
    direction,
  };
}

function buildMovements(
  priced: PricedEntry[],
  currency: string,
): CollectionPricingMovements {
  const movements = priced.map((entry) => toMovement(entry, currency));
  const byTitle = (left: CollectionPriceMovement, right: CollectionPriceMovement) =>
    left.title.localeCompare(right.title);

  return {
    // Drops first, largest amount first: the ones worth acting on.
    drops: movements
      .filter((movement) => movement.direction === "drop")
      .sort(
        (left, right) =>
          (left.changeCents ?? 0) - (right.changeCents ?? 0) ||
          byTitle(left, right),
      ),
    // Records with one observation have no previous price to differ from. They
    // sit after the true holds and say `First check` in the row.
    same: movements
      .filter((movement) => movement.direction === "same")
      .sort((left, right) => {
        const leftFirst = left.previousCents === null ? 1 : 0;
        const rightFirst = right.previousCents === null ? 1 : 0;

        return leftFirst - rightFirst || byTitle(left, right);
      }),
    increases: movements
      .filter((movement) => movement.direction === "increase")
      .sort(
        (left, right) =>
          (right.changeCents ?? 0) - (left.changeCents ?? 0) ||
          byTitle(left, right),
      ),
  };
}

/**
 * One honest read of the tracked vinyls' value: the dominant currency total,
 * the latest move per record, a carry-forward daily series, and every valued
 * vinyl split into drops, unchanged, and increases.
 *
 * Owned and wanted records both count. The Dashboard price overview answers
 * "what is my shelf and shortlist doing", and a wanted record with a recorded
 * marketplace value is exactly the vinyl the collector is watching.
 *
 * Returns `null` when no record has a recorded value yet, so the Dashboard can
 * explain the feature instead of drawing an empty axis.
 */
export function summarizeCollectionPricing(
  records: CollectionRecord[],
  snapshots: CollectionPriceSnapshot[],
  options: SummarizeCollectionPricingOptions = {},
): CollectionPricingSummary | null {
  const now = options.now ?? new Date();
  const windowDays = Math.min(
    365,
    Math.max(7, Math.round(options.windowDays ?? DEFAULT_PRICING_WINDOW_DAYS)),
  );
  const grouped = groupSnapshotsByItem(snapshots);
  const currency = dominantCurrency(records, grouped);

  if (!currency) {
    return null;
  }

  const previousTotal = { cents: 0 };
  const priced: PricedEntry[] = [];

  for (const record of records) {
    const points = (grouped.get(record.id) ?? []).filter(
      (snapshot) =>
        normalizePriceCurrency(snapshot.currency) === currency &&
        snapshotTime(snapshot) <= now.getTime(),
    );
    const latest = points.at(-1);

    if (!latest) {
      continue;
    }

    const previous = points.at(-2) ?? null;

    if (previous) {
      previousTotal.cents += previous.amountCents;
    }

    priced.push({
      record,
      currentCents: latest.amountCents,
      previousCents: previous?.amountCents ?? null,
      observedAt: latest.observedAt,
    });
  }

  if (priced.length === 0) {
    return null;
  }

  const totalCents = priced.reduce(
    (total, entry) => total + entry.currentCents,
    0,
  );
  const moved = priced.filter((entry) => entry.previousCents !== null);
  const changeCents =
    moved.length > 0
      ? moved.reduce(
          (total, entry) => total + entry.currentCents - entry.previousCents!,
          0,
        )
      : null;
  const movements = buildMovements(priced, currency);
  const latestObservedAt = priced.reduce<string | null>(
    (latest, entry) =>
      latest === null ||
      new Date(entry.observedAt).getTime() > new Date(latest).getTime()
        ? entry.observedAt
        : latest,
    null,
  );
  const otherCurrencyCount = records.filter((record) => {
    const points = (grouped.get(record.id) ?? []).filter(
      (snapshot) => snapshotTime(snapshot) <= now.getTime(),
    );
    const hasDominant = points.some(
      (snapshot) => normalizePriceCurrency(snapshot.currency) === currency,
    );
    const hasOther = points.some(
      (snapshot) => normalizePriceCurrency(snapshot.currency) !== currency,
    );

    return !hasDominant && hasOther;
  }).length;

  return {
    currency,
    totalCents,
    pricedCount: priced.length,
    unpricedCount: records.length - priced.length,
    ownedPricedCount: priced.filter((entry) => entry.record.status === "owned")
      .length,
    wantedPricedCount: priced.filter((entry) => entry.record.status === "wanted")
      .length,
    otherCurrencyCount,
    changeCents,
    changePercent:
      changeCents !== null && previousTotal.cents > 0
        ? percentChange(changeCents, previousTotal.cents)
        : null,
    periodDays: windowDays,
    lastObservedAt: latestObservedAt,
    series: buildValueSeries({
      records,
      grouped,
      currency,
      now,
      windowDays,
    }),
    movements,
  };
}
