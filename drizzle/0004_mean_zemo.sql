CREATE TABLE "smart_wants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"master_release_id" integer NOT NULL,
	"source_release_id" integer,
	"artist" text NOT NULL,
	"title" text NOT NULL,
	"image_url" text,
	"source_uri" text,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "smart_wants" ADD CONSTRAINT "smart_wants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "smart_wants_user_id_idx" ON "smart_wants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "smart_wants_master_release_id_idx" ON "smart_wants" USING btree ("master_release_id");--> statement-breakpoint
CREATE INDEX "smart_wants_user_master_idx" ON "smart_wants" USING btree ("user_id","master_release_id");