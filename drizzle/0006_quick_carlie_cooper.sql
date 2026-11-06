DROP INDEX "listening_source_snapshots_provider_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "listening_source_snapshots_provider_source_type_idx" ON "listening_source_snapshots" USING btree ("user_id","provider","source_type");
