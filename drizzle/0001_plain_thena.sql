CREATE TYPE "public"."collection_item_status" AS ENUM('owned', 'wanted');--> statement-breakpoint
CREATE TABLE "collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"discogs_release_id" integer NOT NULL,
	"discogs_master_id" integer,
	"discogs_instance_id" integer,
	"discogs_folder_id" integer,
	"artist" text NOT NULL,
	"title" text NOT NULL,
	"format" jsonb NOT NULL,
	"year" integer,
	"label" text,
	"catalog_number" text,
	"barcode" text,
	"image_url" text,
	"status" "collection_item_status" NOT NULL,
	"tags" jsonb NOT NULL,
	"notes" text,
	"room" text,
	"unit" text,
	"shelf" text,
	"slot" text,
	"price_hint_cents" integer,
	"price_hint_currency" text,
	"price_hint_label" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_items_user_id_idx" ON "collection_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collection_items_user_status_idx" ON "collection_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "collection_items_release_id_idx" ON "collection_items" USING btree ("discogs_release_id");--> statement-breakpoint
CREATE INDEX "collection_items_master_id_idx" ON "collection_items" USING btree ("discogs_master_id");--> statement-breakpoint
CREATE INDEX "collection_items_instance_id_idx" ON "collection_items" USING btree ("discogs_instance_id");--> statement-breakpoint
CREATE INDEX "collection_items_barcode_idx" ON "collection_items" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "collection_items_catalog_number_idx" ON "collection_items" USING btree ("catalog_number");--> statement-breakpoint
CREATE INDEX "collection_items_user_location_idx" ON "collection_items" USING btree ("user_id","room","unit","shelf");