CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discogs_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid,
	"source_key" text NOT NULL,
	"normalized_artist" text NOT NULL,
	"normalized_album" text NOT NULL,
	"discogs_release_id" integer,
	"confidence" integer NOT NULL,
	"recommendation_score" integer NOT NULL,
	"match_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotify_accounts" (
	"user_id" uuid NOT NULL,
	"spotify_user_id" text NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"scope" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spotify_accounts_user_id_pk" PRIMARY KEY("user_id")
);
--> statement-breakpoint
CREATE TABLE "spotify_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"snapshot_id" text,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spotify_user_id" text NOT NULL,
	"display_name" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id_hash" text,
	"record_key" text NOT NULL,
	"spotify_album" text NOT NULL,
	"spotify_artist" text NOT NULL,
	"discogs_title" text NOT NULL,
	"discogs_artist" text NOT NULL,
	"discogs_url" text,
	"record_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discogs_matches" ADD CONSTRAINT "discogs_matches_import_id_spotify_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."spotify_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_accounts" ADD CONSTRAINT "spotify_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_imports" ADD CONSTRAINT "spotify_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_cache_expires_at_idx" ON "api_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "discogs_matches_import_id_idx" ON "discogs_matches" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "discogs_matches_source_key_idx" ON "discogs_matches" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "discogs_matches_release_id_idx" ON "discogs_matches" USING btree ("discogs_release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spotify_accounts_spotify_user_id_idx" ON "spotify_accounts" USING btree ("spotify_user_id");--> statement-breakpoint
CREATE INDEX "spotify_imports_user_id_idx" ON "spotify_imports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "spotify_imports_source_idx" ON "spotify_imports" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_spotify_user_id_idx" ON "users" USING btree ("spotify_user_id");--> statement-breakpoint
CREATE INDEX "wishlist_items_user_id_idx" ON "wishlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_items_session_id_hash_idx" ON "wishlist_items" USING btree ("session_id_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_items_user_record_idx" ON "wishlist_items" USING btree ("user_id","record_key");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_items_session_record_idx" ON "wishlist_items" USING btree ("session_id_hash","record_key");