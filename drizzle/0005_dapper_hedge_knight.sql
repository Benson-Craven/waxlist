ALTER TABLE "spotify_imports" RENAME TO "listening_source_snapshots";--> statement-breakpoint
ALTER TABLE "wishlist_items" RENAME COLUMN "spotify_album" TO "source_album";--> statement-breakpoint
ALTER TABLE "wishlist_items" RENAME COLUMN "spotify_artist" TO "source_artist";--> statement-breakpoint
ALTER TABLE "discogs_matches" DROP CONSTRAINT "discogs_matches_import_id_spotify_imports_id_fk";
--> statement-breakpoint
ALTER TABLE "listening_source_snapshots" DROP CONSTRAINT "spotify_imports_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "spotify_imports_user_id_idx";--> statement-breakpoint
DROP INDEX "spotify_imports_source_idx";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "spotify_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "discogs_matches" ADD COLUMN "source_provider" text DEFAULT 'spotify' NOT NULL;--> statement-breakpoint
ALTER TABLE "listening_source_snapshots" ADD COLUMN "provider" text DEFAULT 'spotify' NOT NULL;--> statement-breakpoint
ALTER TABLE "listening_source_snapshots" ADD COLUMN "window_days" integer;--> statement-breakpoint
ALTER TABLE "listening_source_snapshots" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_user_id" text;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD COLUMN "source_provider" text DEFAULT 'spotify' NOT NULL;--> statement-breakpoint
ALTER TABLE "discogs_matches" ADD CONSTRAINT "discogs_matches_import_id_listening_source_snapshots_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."listening_source_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_source_snapshots" ADD CONSTRAINT "listening_source_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listening_source_snapshots_user_id_idx" ON "listening_source_snapshots" USING btree ("user_id");--> statement-breakpoint
DELETE FROM "listening_source_snapshots"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      row_number() OVER (
        PARTITION BY "user_id", "provider", "source_type"
        ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
      ) AS "snapshot_rank"
    FROM "listening_source_snapshots"
    WHERE "user_id" IS NOT NULL
  ) AS "ranked_snapshots"
  WHERE "snapshot_rank" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "listening_source_snapshots_provider_idx" ON "listening_source_snapshots" USING btree ("user_id","provider","source_type");--> statement-breakpoint
CREATE INDEX "listening_source_snapshots_source_idx" ON "listening_source_snapshots" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_user_id_idx" ON "users" USING btree ("auth_user_id");
