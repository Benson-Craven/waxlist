import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { ListeningSourceSnapshot } from "@/lib/listening/types";
import type { PressingEvidence } from "@/lib/pressing-detective/matching";
import type { SpotifyPlaylistImportSummary } from "@/lib/spotify/workspace";

export const collectionItemStatus = pgEnum("collection_item_status", [
  "owned",
  "wanted",
]);

export const discogsImportRunStatus = pgEnum("discogs_import_run_status", [
  "running",
  "rate_limited",
  "completed",
  "failed",
]);

export const pressingInvestigationStatus = pgEnum(
  "pressing_investigation_status",
  ["active", "resolved", "dismissed"],
);

export const pressingResolutionKind = pgEnum("pressing_resolution_kind", [
  "exact",
  "shortlist",
  "unknown",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: text("auth_user_id"),
    spotifyUserId: text("spotify_user_id"),
    displayName: text("display_name"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_auth_user_id_idx").on(table.authUserId),
    uniqueIndex("users_spotify_user_id_idx").on(table.spotifyUserId),
  ],
);

export const spotifyAccounts = pgTable(
  "spotify_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spotifyUserId: text("spotify_user_id").notNull(),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    scope: text("scope"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId],
      name: "spotify_accounts_user_id_pk",
    }),
    uniqueIndex("spotify_accounts_spotify_user_id_idx").on(table.spotifyUserId),
  ],
);

export const apiCache = pgTable(
  "api_cache",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("api_cache_expires_at_idx").on(table.expiresAt)],
);

export const listeningSourceSnapshots = pgTable(
  "listening_source_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    provider: text("provider").default("spotify").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    snapshotId: text("snapshot_id"),
    windowDays: integer("window_days"),
    summary: jsonb("summary")
      .$type<ListeningSourceSnapshot | SpotifyPlaylistImportSummary>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("listening_source_snapshots_user_id_idx").on(table.userId),
    uniqueIndex("listening_source_snapshots_provider_source_type_idx").on(
      table.userId,
      table.provider,
      table.sourceType,
    ),
    index("listening_source_snapshots_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export const discogsMatches = pgTable(
  "discogs_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importId: uuid("import_id").references(() => listeningSourceSnapshots.id, {
      onDelete: "set null",
    }),
    sourceProvider: text("source_provider").default("spotify").notNull(),
    sourceKey: text("source_key").notNull(),
    normalizedArtist: text("normalized_artist").notNull(),
    normalizedAlbum: text("normalized_album").notNull(),
    discogsReleaseId: integer("discogs_release_id"),
    confidence: integer("confidence").notNull(),
    recommendationScore: integer("recommendation_score").notNull(),
    matchPayload: jsonb("match_payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("discogs_matches_import_id_idx").on(table.importId),
    index("discogs_matches_source_key_idx").on(table.sourceKey),
    index("discogs_matches_release_id_idx").on(table.discogsReleaseId),
  ],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionIdHash: text("session_id_hash"),
    recordKey: text("record_key").notNull(),
    sourceProvider: text("source_provider").default("spotify").notNull(),
    sourceAlbum: text("source_album").notNull(),
    sourceArtist: text("source_artist").notNull(),
    discogsTitle: text("discogs_title").notNull(),
    discogsArtist: text("discogs_artist").notNull(),
    discogsUrl: text("discogs_url"),
    recordPayload: jsonb("record_payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("wishlist_items_user_id_idx").on(table.userId),
    index("wishlist_items_session_id_hash_idx").on(table.sessionIdHash),
    uniqueIndex("wishlist_items_user_record_idx").on(
      table.userId,
      table.recordKey,
    ),
    uniqueIndex("wishlist_items_session_record_idx").on(
      table.sessionIdHash,
      table.recordKey,
    ),
  ],
);

export const smartWants = pgTable(
  "smart_wants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    masterReleaseId: integer("master_release_id").notNull(),
    sourceReleaseId: integer("source_release_id"),
    artist: text("artist").notNull(),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    sourceUri: text("source_uri"),
    rules: jsonb("rules").$type<{
      formats: string[];
      countries: string[];
      yearFrom: number | null;
      yearTo: number | null;
      excludedTags: string[];
      excludeOwned: boolean;
      exactPressingRequired: boolean;
      maxItemPrice: {
        amountCents: number;
        currency: string;
      } | null;
      minMediaCondition: string | null;
      minSleeveCondition: string | null;
    }>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("smart_wants_user_id_idx").on(table.userId),
    index("smart_wants_master_release_id_idx").on(table.masterReleaseId),
    index("smart_wants_user_master_idx").on(
      table.userId,
      table.masterReleaseId,
    ),
  ],
);

export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    discogsReleaseId: integer("discogs_release_id").notNull(),
    discogsMasterId: integer("discogs_master_id"),
    discogsInstanceId: integer("discogs_instance_id"),
    discogsFolderId: integer("discogs_folder_id"),
    artist: text("artist").notNull(),
    title: text("title").notNull(),
    format: jsonb("format").$type<string[]>().notNull(),
    year: integer("year"),
    label: text("label"),
    catalogNumber: text("catalog_number"),
    barcode: text("barcode"),
    imageUrl: text("image_url"),
    mediaCondition: text("media_condition"),
    sleeveCondition: text("sleeve_condition"),
    rating: integer("rating"),
    favourite: boolean("favourite").default(false).notNull(),
    status: collectionItemStatus("status").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    notes: text("notes"),
    group: text("group"),
    unit: text("unit"),
    shelf: text("shelf"),
    slot: text("slot"),
    priceHintCents: integer("price_hint_cents"),
    priceHintCurrency: text("price_hint_currency"),
    priceHintLabel: text("price_hint_label"),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("collection_items_user_id_idx").on(table.userId),
    index("collection_items_user_status_idx").on(table.userId, table.status),
    uniqueIndex("collection_items_user_instance_idx").on(
      table.userId,
      table.discogsInstanceId,
    ),
    index("collection_items_release_id_idx").on(table.discogsReleaseId),
    index("collection_items_master_id_idx").on(table.discogsMasterId),
    index("collection_items_instance_id_idx").on(table.discogsInstanceId),
    index("collection_items_barcode_idx").on(table.barcode),
    index("collection_items_catalog_number_idx").on(table.catalogNumber),
    index("collection_items_user_location_idx").on(
      table.userId,
      table.group,
      table.unit,
      table.shelf,
    ),
  ],
);

export const collectionPriceSnapshots = pgTable(
  "collection_price_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionItemId: uuid("collection_item_id")
      .notNull()
      .references(() => collectionItems.id, { onDelete: "cascade" }),
    discogsReleaseId: integer("discogs_release_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    source: text("source").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("collection_price_snapshots_user_observed_idx").on(
      table.userId,
      table.observedAt,
    ),
    index("collection_price_snapshots_item_observed_idx").on(
      table.collectionItemId,
      table.observedAt,
    ),
    index("collection_price_snapshots_release_idx").on(
      table.discogsReleaseId,
    ),
  ],
);

export const spinLogEntries = pgTable(
  "spin_log_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionItemId: uuid("collection_item_id")
      .notNull()
      .references(() => collectionItems.id, { onDelete: "cascade" }),
    spunAt: timestamp("spun_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    side: text("side"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("spin_log_entries_user_spun_at_idx").on(
      table.userId,
      table.spunAt,
    ),
    index("spin_log_entries_collection_item_idx").on(table.collectionItemId),
  ],
);

export const discogsImportRuns = pgTable(
  "discogs_import_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    status: discogsImportRunStatus("status").notNull(),
    discogsUsername: text("discogs_username"),
    discogsFolderId: integer("discogs_folder_id").notNull(),
    nextPage: integer("next_page").notNull(),
    perPage: integer("per_page").notNull(),
    totalPages: integer("total_pages"),
    totalItems: integer("total_items"),
    importedCount: integer("imported_count").default(0).notNull(),
    failedCount: integer("failed_count").default(0).notNull(),
    failures: jsonb("failures")
      .$type<
        Array<{
          page: number;
          releaseId: number | null;
          instanceId: number | null;
          message: string;
        }>
      >()
      .notNull(),
    rateLimit: jsonb("rate_limit")
      .$type<{
        limit: number | null;
        used: number | null;
        remaining: number | null;
      } | null>()
      .notNull(),
    retryAfterSeconds: integer("retry_after_seconds"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("discogs_import_runs_user_id_idx").on(table.userId),
    index("discogs_import_runs_user_status_idx").on(table.userId, table.status),
  ],
);

export const pressingInvestigations = pgTable(
  "pressing_investigations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    masterReleaseId: integer("master_release_id"),
    seedReleaseId: integer("seed_release_id"),
    inputSource: text("input_source").notNull(),
    userEvidence: jsonb("user_evidence").$type<PressingEvidence>().notNull(),
    remainingCandidateIds: jsonb("remaining_candidate_ids")
      .$type<number[]>()
      .notNull(),
    status: pressingInvestigationStatus("status").notNull(),
    resolutionKind: pressingResolutionKind("resolution_kind").notNull(),
    resolvedReleaseId: integer("resolved_release_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pressing_investigations_user_id_idx").on(table.userId),
    index("pressing_investigations_user_status_idx").on(
      table.userId,
      table.status,
    ),
    index("pressing_investigations_master_release_id_idx").on(
      table.masterReleaseId,
    ),
  ],
);
