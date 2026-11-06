CREATE TYPE "public"."pressing_investigation_status" AS ENUM('active', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."pressing_resolution_kind" AS ENUM('exact', 'shortlist', 'unknown');--> statement-breakpoint
CREATE TABLE "pressing_investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"master_release_id" integer,
	"seed_release_id" integer,
	"input_source" text NOT NULL,
	"user_evidence" jsonb NOT NULL,
	"remaining_candidate_ids" jsonb NOT NULL,
	"status" "pressing_investigation_status" NOT NULL,
	"resolution_kind" "pressing_resolution_kind" NOT NULL,
	"resolved_release_id" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pressing_investigations" ADD CONSTRAINT "pressing_investigations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pressing_investigations_user_id_idx" ON "pressing_investigations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pressing_investigations_user_status_idx" ON "pressing_investigations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "pressing_investigations_master_release_id_idx" ON "pressing_investigations" USING btree ("master_release_id");
