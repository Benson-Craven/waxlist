import type { CollectionRecord } from "@/lib/collection/record";

export const SPIN_SIDES = ["A", "B", "C", "D"] as const;
export type SpinSide = (typeof SPIN_SIDES)[number];

export const SPIN_NOTE_MAX_LENGTH = 280;
export const SPIN_SUGGESTION_MIN_DAYS = 7;
export const SPIN_SUGGESTION_LIMIT = 3;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export type SpinLogEntry = {
  id: string;
  collectionItemId: string;
  spunAt: string;
  side: SpinSide | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SpinLogStats = {
  totalSpins: number;
  spinsLast7Days: number;
  uniqueRecords: number;
  currentStreakDays: number;
  lastSpinAt: string | null;
};

export type SpinLogInput = {
  collectionItemId: string;
  spunAt: Date;
  side: SpinSide | null;
  note: string | null;
};

export type NormalizedSpinLogInput =
  | { ok: true; value: SpinLogInput }
  | { ok: false; message: string };

export type SpinLogTimestampEntry = {
  spunAt: string | Date;
  collectionItemId: string;
};

export type SpinDayGroup = {
  key: string;
  label: string;
  spins: SpinLogEntry[];
};

export type SpinSuggestion = {
  record: CollectionRecord;
  lastSpunAt: string | null;
  daysSinceLastSpin: number | null;
  reason: "never" | "due";
};

/**
 * A side is optional: null means the whole record was played. Unknown input
 * returns undefined so API routes can reject it instead of silently recording
 * the wrong side.
 */
export function normalizeSpinSide(
  value: unknown,
): SpinSide | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toUpperCase().replace(/^SIDE\s+/, "");

  if (!normalized || normalized === "FULL" || normalized === "ALBUM") {
    return null;
  }

  return SPIN_SIDES.includes(normalized as SpinSide)
    ? (normalized as SpinSide)
    : undefined;
}

/**
 * Returns undefined for non-text input and null for an empty note. Callers
 * enforce SPIN_NOTE_MAX_LENGTH after trimming so the stored value matches the
 * character count shown in the form.
 */
export function normalizeSpinNote(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeSpinTimestamp(
  value: unknown,
  now: Date = new Date(),
): Date | null {
  if (value === undefined || value === null || value === "") {
    return now;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const timestamp = new Date(parsed);

  // A few minutes of clock skew are harmless; a future listening session is
  // not, and it would also break the streak and "last played" ordering.
  if (timestamp.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    return null;
  }

  return timestamp;
}

export function normalizeSpinLogInput(
  payload: unknown,
  now: Date = new Date(),
): NormalizedSpinLogInput {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Spin log entry is invalid." };
  }

  const source = payload as Record<string, unknown>;
  const collectionItemId =
    typeof source.collectionItemId === "string"
      ? source.collectionItemId.trim()
      : "";

  if (!UUID_PATTERN.test(collectionItemId)) {
    return { ok: false, message: "Choose a collection record to spin." };
  }

  const side = normalizeSpinSide(source.side);

  if (side === undefined) {
    return {
      ok: false,
      message: "Choose a side from A to D, or leave it on full album.",
    };
  }

  const note = normalizeSpinNote(source.note);

  if (note === undefined) {
    return { ok: false, message: "Spin notes must be text." };
  }

  if (note && note.length > SPIN_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      message: `Keep spin notes under ${SPIN_NOTE_MAX_LENGTH} characters.`,
    };
  }

  const spunAt = normalizeSpinTimestamp(source.spunAt, now);

  if (!spunAt) {
    return {
      ok: false,
      message: "Spin time must be a valid time that is not in the future.",
    };
  }

  return {
    ok: true,
    value: {
      collectionItemId,
      spunAt,
      side,
      note,
    },
  };
}

export function serializeSpinLogEntry(row: {
  id: string;
  collectionItemId: string;
  spunAt: Date;
  side: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SpinLogEntry {
  const side = normalizeSpinSide(row.side);

  return {
    id: row.id,
    collectionItemId: row.collectionItemId,
    spunAt: row.spunAt.toISOString(),
    side: side ?? null,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function timestampFor(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDateFromKey(key: string): Date | null {
  const [year, month, day] = key.split("-").map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function buildSpinStats(
  entries: SpinLogTimestampEntry[],
  now: Date = new Date(),
): SpinLogStats {
  const cutoff = now.getTime() - 7 * DAY_MS;
  const dayKeys = new Set<string>();
  const recordIds = new Set<string>();
  let spinsLast7Days = 0;
  let lastSpinTime = Number.NEGATIVE_INFINITY;

  for (const entry of entries) {
    const timestamp = timestampFor(entry.spunAt);

    if (!timestamp) {
      continue;
    }

    const time = timestamp.getTime();

    recordIds.add(entry.collectionItemId);
    dayKeys.add(localDayKey(timestamp));

    if (time >= cutoff && time <= now.getTime() + FUTURE_TOLERANCE_MS) {
      spinsLast7Days += 1;
    }

    lastSpinTime = Math.max(lastSpinTime, time);
  }

  let currentStreakDays = 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!dayKeys.has(localDayKey(today))) {
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
    );

    if (!dayKeys.has(localDayKey(yesterday))) {
      currentStreakDays = 0;
    } else {
      today.setTime(yesterday.getTime());
    }
  }

  if (dayKeys.has(localDayKey(today))) {
    let cursor = today;

    while (dayKeys.has(localDayKey(cursor))) {
      currentStreakDays += 1;
      cursor = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() - 1,
      );
    }
  }

  return {
    totalSpins: entries.length,
    spinsLast7Days,
    uniqueRecords: recordIds.size,
    currentStreakDays,
    lastSpinAt:
      lastSpinTime === Number.NEGATIVE_INFINITY
        ? null
        : new Date(lastSpinTime).toISOString(),
  };
}

export function formatSpinDayLabel(
  dayKey: string,
  now: Date = new Date(),
): string {
  const todayKey = localDayKey(now);

  if (dayKey === todayKey) {
    return "Today";
  }

  const date = localDateFromKey(dayKey);

  if (!date) {
    return dayKey;
  }

  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );

  if (dayKey === localDayKey(yesterday)) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function formatSpinTime(value: string | Date): string {
  const timestamp = timestampFor(value);

  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

/**
 * Newest first, grouped by the collector's local day so an 11pm spin lands on
 * the evening it happened rather than the next UTC day.
 */
export function groupSpinsByDay(
  entries: SpinLogEntry[],
  now: Date = new Date(),
): SpinDayGroup[] {
  const groups = new Map<string, SpinLogEntry[]>();

  for (const entry of [...entries].sort(
    (left, right) => Date.parse(right.spunAt) - Date.parse(left.spunAt),
  )) {
    const timestamp = timestampFor(entry.spunAt);

    if (!timestamp) {
      continue;
    }

    const key = localDayKey(timestamp);
    const group = groups.get(key);

    if (group) {
      group.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return Array.from(groups, ([key, spins]) => ({
    key,
    label: formatSpinDayLabel(key, now),
    spins,
  }));
}

export function buildSpinSuggestions(
  records: CollectionRecord[],
  entries: SpinLogTimestampEntry[],
  options: {
    now?: Date;
    limit?: number;
    minDaysSinceSpin?: number;
  } = {},
): SpinSuggestion[] {
  const now = options.now ?? new Date();
  const limit = Math.max(0, Math.floor(options.limit ?? SPIN_SUGGESTION_LIMIT));
  const minDaysSinceSpin = Math.max(
    0,
    options.minDaysSinceSpin ?? SPIN_SUGGESTION_MIN_DAYS,
  );
  const lastSpunByRecord = new Map<string, string>();

  for (const entry of entries) {
    const timestamp = timestampFor(entry.spunAt);

    if (!timestamp) {
      continue;
    }

    const existing = lastSpunByRecord.get(entry.collectionItemId);
    const time = timestamp.getTime();

    if (!existing || time > Date.parse(existing)) {
      lastSpunByRecord.set(entry.collectionItemId, timestamp.toISOString());
    }
  }

  return records
    .filter((record) => record.status === "owned")
    .flatMap<SpinSuggestion>((record) => {
      const lastSpunAt = lastSpunByRecord.get(record.id) ?? null;

      if (!lastSpunAt) {
        return [
          {
            record,
            lastSpunAt: null,
            daysSinceLastSpin: null,
            reason: "never",
          },
        ];
      }

      const daysSinceLastSpin = Math.floor(
        (now.getTime() - Date.parse(lastSpunAt)) / DAY_MS,
      );

      return daysSinceLastSpin >= minDaysSinceSpin
        ? [
            {
              record,
              lastSpunAt,
              daysSinceLastSpin,
              reason: "due",
            },
          ]
        : [];
    })
    .sort((left, right) => {
      const leftOverdue = left.lastSpunAt
        ? Date.parse(left.lastSpunAt)
        : Number.NEGATIVE_INFINITY;
      const rightOverdue = right.lastSpunAt
        ? Date.parse(right.lastSpunAt)
        : Number.NEGATIVE_INFINITY;

      if (leftOverdue !== rightOverdue) {
        return leftOverdue - rightOverdue;
      }

      return `${left.record.artist} ${left.record.title}`.localeCompare(
        `${right.record.artist} ${right.record.title}`,
      );
    })
    .slice(0, limit);
}
