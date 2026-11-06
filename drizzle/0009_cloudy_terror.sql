CREATE TABLE "spin_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"collection_item_id" uuid NOT NULL,
	"spun_at" timestamp with time zone DEFAULT now() NOT NULL,
	"side" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spin_log_entries" ADD CONSTRAINT "spin_log_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_log_entries" ADD CONSTRAINT "spin_log_entries_collection_item_id_collection_items_id_fk" FOREIGN KEY ("collection_item_id") REFERENCES "public"."collection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spin_log_entries_user_spun_at_idx" ON "spin_log_entries" USING btree ("user_id","spun_at");--> statement-breakpoint
CREATE INDEX "spin_log_entries_collection_item_idx" ON "spin_log_entries" USING btree ("collection_item_id");