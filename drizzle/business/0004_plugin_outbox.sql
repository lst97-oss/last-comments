-- Plugin outbox: comment events and one delivery row per subscribing plugin. scripts/plugin-worker.ts
-- claims pending deliveries and purges delivered events after the retention window.
CREATE TYPE "public"."plugin_delivery_status" AS ENUM('pending', 'processing', 'delivered', 'dead_letter');
--> statement-breakpoint
CREATE TABLE "plugin_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"plugin_id" text NOT NULL,
	"status" "plugin_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"api_version" integer DEFAULT 1 NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_events_type_check" CHECK ("plugin_events"."event_type" in ('comment.created', 'comment.edited', 'comment.hidden', 'comment.deleted', 'comment.restored', 'comment.pinned', 'comment.voted', 'page.locked', 'page.unlocked', 'page.deleted', 'user.blocked', 'user.unblocked', 'user.verified', 'user.unverified'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "plugin_deliveries_event_plugin_uq" ON "plugin_deliveries" USING btree ("event_id","plugin_id");
--> statement-breakpoint
ALTER TABLE "plugin_deliveries" ADD CONSTRAINT "plugin_deliveries_event_id_plugin_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."plugin_events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plugin_events" ADD CONSTRAINT "plugin_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "plugin_deliveries_due_idx" ON "plugin_deliveries" USING btree ("next_attempt_at") WHERE "plugin_deliveries"."status" in ('pending', 'processing');
--> statement-breakpoint
CREATE INDEX "plugin_events_site_time_idx" ON "plugin_events" USING btree ("site_id","occurred_at");
