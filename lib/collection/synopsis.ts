import type { CollectionRecord } from "@/lib/collection/record";

export type CollectionSynopsisFact = {
  id: "format" | "era" | "artist" | "rating";
  label: string;
  value: string;
  detail: string | null;
};

/**
 * A short, plain-language read of the owned shelf: what it mostly is, when it
 * is from, who shows up most, and how it is rated. `null` means nothing is
 * owned yet, so the Dashboard keeps its empty state rather than a synopsis of
 * zeroes.
 */
export type CollectionSynopsis = {
  headline: string;
  facts: CollectionSynopsisFact[];
};

type FormatKind = {
  id: string;
  label: string;
  plural: string;
  pattern: RegExp;
};

type FormatTally = { kind: FormatKind; count: number };
type ArtistTally = { name: string; count: number };
type DecadeTally = { decades: number; count: number; min: number; max: number };

// Narrowest size first so one release counts once even when Discogs lists
// "Vinyl" together with "LP", "Album", and a size.
const FORMAT_KINDS: FormatKind[] = [
  {
    id: "7",
    label: '7"',
    plural: "7-inch singles",
    pattern: /^7\s*(?:["”]|[- ]?inch)/,
  },
  {
    id: "10",
    label: '10"',
    plural: "10-inch records",
    pattern: /^10\s*(?:["”]|[- ]?inch)/,
  },
  {
    id: "12",
    label: '12"',
    plural: "12-inch records",
    pattern: /^12\s*(?:["”]|[- ]?inch)/,
  },
  { id: "ep", label: "EP", plural: "EPs", pattern: /^ep$/ },
  { id: "lp", label: "LP", plural: "LPs", pattern: /^(lp|album)$/ },
];

const EARLIEST_YEAR = 1900;
const LATEST_YEAR = 2100;

function compareText(left: string, right: string) {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();

  if (normalizedLeft === normalizedRight) return 0;

  return normalizedLeft < normalizedRight ? -1 : 1;
}

/**
 * Discogs stores formats as a mixed list ("Vinyl", "LP", "Album", "Stereo")
 * and some imports keep the whole thing as one comma-joined string, so split
 * before matching.
 */
function readFormatTokens(record: CollectionRecord) {
  return record.format
    .flatMap((value) => value.split(/[,/]/))
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean);
}

function readFormatKind(record: CollectionRecord): FormatKind | null {
  const tokens = readFormatTokens(record);

  return (
    FORMAT_KINDS.find((kind) =>
      tokens.some((token) => kind.pattern.test(token)),
    ) ?? null
  );
}

function readYear(record: CollectionRecord): number | null {
  const year = record.year;

  return typeof year === "number" &&
    Number.isFinite(year) &&
    year >= EARLIEST_YEAR &&
    year <= LATEST_YEAR
    ? year
    : null;
}

function readArtistKey(artist: string) {
  return artist.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatYearSpan(span: DecadeTally) {
  return span.min === span.max ? `${span.min}` : `${span.min}–${span.max}`;
}

function buildHeadline(input: {
  owned: CollectionRecord[];
  formatMajority: FormatTally | null;
  decadeMajority: DecadeTally | null;
  repeatedArtist: ArtistTally | null;
}) {
  const { owned, formatMajority, decadeMajority, repeatedArtist } = input;

  if (owned.length === 1) {
    const [record] = owned;
    return `The shelf starts with ${record.artist} — ${record.title}.`;
  }

  if (!formatMajority && !decadeMajority && !repeatedArtist) {
    return "A mixed shelf that is still taking shape.";
  }

  const lead = formatMajority
    ? `Mostly ${formatMajority.kind.plural}`
    : "A mixed shelf";
  const era = decadeMajority ? ` from the ${decadeMajority.decades}s` : "";
  const artist = repeatedArtist ? `, led by ${repeatedArtist.name}` : "";

  return `${lead}${era}${artist}.`;
}

export function buildCollectionSynopsis(
  records: CollectionRecord[],
): CollectionSynopsis | null {
  const owned = records.filter((record) => record.status === "owned");

  if (owned.length === 0) {
    return null;
  }

  const formatTallies = new Map<string, FormatTally>();
  const decadeTallies = new Map<number, DecadeTally>();
  const artistTallies = new Map<string, ArtistTally>();
  let ratingTotal = 0;
  let ratedCount = 0;

  for (const record of owned) {
    const formatKind = readFormatKind(record);

    if (formatKind) {
      const current = formatTallies.get(formatKind.id);
      formatTallies.set(formatKind.id, {
        kind: formatKind,
        count: (current?.count ?? 0) + 1,
      });
    }

    const year = readYear(record);

    if (year !== null) {
      const decades = Math.floor(year / 10) * 10;
      const current = decadeTallies.get(decades);
      decadeTallies.set(decades, {
        decades,
        count: (current?.count ?? 0) + 1,
        min: current ? Math.min(current.min, year) : year,
        max: current ? Math.max(current.max, year) : year,
      });
    }

    const key = readArtistKey(record.artist);

    if (key) {
      const current = artistTallies.get(key);
      artistTallies.set(key, {
        name: current?.name ?? record.artist.trim(),
        count: (current?.count ?? 0) + 1,
      });
    }

    if (typeof record.rating === "number" && record.rating > 0) {
      ratingTotal += record.rating;
      ratedCount += 1;
    }
  }

  const sortedFormats = [...formatTallies.values()].sort(
    (left, right) =>
      right.count - left.count || compareText(left.kind.label, right.kind.label),
  );
  const sortedDecades = [...decadeTallies.values()].sort(
    (left, right) =>
      right.count - left.count || left.decades - right.decades,
  );

  const topFormat = sortedFormats[0] ?? null;
  const topDecade = sortedDecades[0] ?? null;
  const topArtist =
    [...artistTallies.values()].sort(
      (left, right) =>
        right.count - left.count || compareText(left.name, right.name),
    )[0] ?? null;

  // A fact only names a leader when one bucket is strictly ahead. An even
  // split is described as mixed instead of picking an arbitrary winner.
  const hasLeadingFormat =
    topFormat !== null &&
    (sortedFormats.length === 1 || topFormat.count > sortedFormats[1].count);
  const hasLeadingDecade =
    topDecade !== null &&
    (sortedDecades.length === 1 || topDecade.count > sortedDecades[1].count);

  // "Mostly" and "from the 1970s" only hold when that bucket is the majority,
  // so a shelf split across styles stays honestly mixed.
  const formatMajority =
    topFormat && topFormat.count * 2 > owned.length ? topFormat : null;
  const decadeMajority =
    topDecade && topDecade.count * 2 > owned.length ? topDecade : null;
  const repeatedArtist =
    topArtist && topArtist.count > 1 ? topArtist : null;

  const facts: CollectionSynopsisFact[] = [];

  if (hasLeadingFormat && topFormat) {
    facts.push({
      id: "format",
      label: "Format",
      value: topFormat.kind.label,
      detail:
        owned.length > 1 ? `${topFormat.count} of ${owned.length}` : null,
    });
  } else if (sortedFormats.length > 1) {
    facts.push({
      id: "format",
      label: "Format",
      value: "Mixed",
      detail: `${sortedFormats.length} formats`,
    });
  }

  if (hasLeadingDecade && topDecade) {
    facts.push({
      id: "era",
      label: "Era",
      value: `${topDecade.decades}s`,
      detail: formatYearSpan(topDecade),
    });
  } else if (sortedDecades.length > 1) {
    const years = sortedDecades.map((entry) => entry.min);
    const lastYear = Math.max(...sortedDecades.map((entry) => entry.max));

    facts.push({
      id: "era",
      label: "Era",
      value: `${Math.min(...years)}–${lastYear}`,
      detail: `${sortedDecades.length} decades`,
    });
  }

  if (repeatedArtist) {
    facts.push({
      id: "artist",
      label: "Most collected",
      value: repeatedArtist.name,
      detail: `${repeatedArtist.count} records`,
    });
  }

  if (ratedCount > 0) {
    const average = Math.round((ratingTotal / ratedCount) * 10) / 10;
    facts.push({
      id: "rating",
      label: "Average rating",
      value: average.toFixed(1),
      detail: `${ratedCount} rated`,
    });
  } else {
    facts.push({
      id: "rating",
      label: "Average rating",
      value: "Unrated",
      detail: null,
    });
  }

  return {
    headline: buildHeadline({
      owned,
      formatMajority,
      decadeMajority,
      repeatedArtist,
    }),
    facts,
  };
}
