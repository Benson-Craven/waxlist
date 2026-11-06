CREATE TABLE "collection_price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"collection_item_id" uuid NOT NULL,
	"discogs_release_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"source" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_price_snapshots" ADD CONSTRAINT "collection_price_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_price_snapshots" ADD CONSTRAINT "collection_price_snapshots_collection_item_id_collection_items_id_fk" FOREIGN KEY ("collection_item_id") REFERENCES "public"."collection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_price_snapshots_user_observed_idx" ON "collection_price_snapshots" USING btree ("user_id","observed_at");--> statement-breakpoint
CREATE INDEX "collection_price_snapshots_item_observed_idx" ON "collection_price_snapshots" USING btree ("collection_item_id","observed_at");--> statement-breakpoint
CREATE INDEX "collection_price_snapshots_release_idx" ON "collection_price_snapshots" USING btree ("discogs_release_id");