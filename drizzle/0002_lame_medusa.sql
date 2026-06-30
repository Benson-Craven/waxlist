CREATE TYPE "public"."discogs_import_run_status" AS ENUM('running', 'rate_limited', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "discogs_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"status" "discogs_import_run_status" NOT NULL,
	"discogs_username" text,
	"discogs_folder_id" integer NOT NULL,
	"next_page" integer NOT NULL,
	"per_page" integer NOT NULL,
	"total_pages" integer,
	"total_items" integer,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"failures" jsonb NOT NULL,
	"rate_limit" jsonb NOT NULL,
	"retry_after_seconds" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discogs_import_runs" ADD CONSTRAINT "discogs_import_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discogs_import_runs_user_id_idx" ON "discogs_import_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "discogs_import_runs_user_status_idx" ON "discogs_import_runs" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_items_user_instance_idx" ON "collection_items" USING btree ("user_id","discogs_instance_id");