import {
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

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spotifyUserId: text("spotify_user_id").notNull(),
    displayName: text("display_name"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("users_spotify_user_id_idx").on(table.spotifyUserId)],
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

export const spotifyImports = pgTable(
  "spotify_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    snapshotId: text("snapshot_id"),
    summary: jsonb("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("spotify_imports_user_id_idx").on(table.userId),
    index("spotify_imports_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const discogsMatches = pgTable(
  "discogs_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importId: uuid("import_id").references(() => spotifyImports.id, {
      onDelete: "set null",
    }),
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
    spotifyAlbum: text("spotify_album").notNull(),
    spotifyArtist: text("spotify_artist").notNull(),
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
    status: collectionItemStatus("status").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    notes: text("notes"),
    room: text("room"),
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
      table.room,
      table.unit,
      table.shelf,
    ),
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
