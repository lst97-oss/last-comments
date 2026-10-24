ALTER TABLE "sites" ADD COLUMN "access" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "gateway_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_access_check" CHECK ("sites"."access" in ('open', 'login', 'private'));