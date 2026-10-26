-- Tenancy: sites, the origins each site accepts, its memberships, and the API keys that act for a site.
-- apikey is the Better Auth API-key plugin table (the key itself); api_key_sites binds a key to one site.
CREATE TYPE "public"."site_role" AS ENUM('admin', 'moderator');
--> statement-breakpoint
CREATE TABLE "api_key_sites" (
	"api_key_id" text PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikey" (
	"id" text PRIMARY KEY NOT NULL,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"reference_id" text NOT NULL,
	"prefix" text,
	"key" text NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp with time zone,
	"enabled" boolean DEFAULT true,
	"rate_limit_enabled" boolean DEFAULT true,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0,
	"remaining" integer,
	"last_request" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"permissions" text,
	"metadata" jsonb,
	CONSTRAINT "apikey_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "site_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "site_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_origins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"origin" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"body_limit" integer,
	"access" text DEFAULT 'open' NOT NULL,
	"gateway_only" boolean DEFAULT false NOT NULL,
	"votes_enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sites_key_unique" UNIQUE("key"),
	CONSTRAINT "sites_body_limit_check" CHECK ("sites"."body_limit" is null or "sites"."body_limit" between 1 and 10000),
	CONSTRAINT "sites_access_check" CHECK ("sites"."access" in ('open', 'login', 'private'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "site_memberships_site_user_uq" ON "site_memberships" USING btree ("site_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "site_origins_site_origin_uq" ON "site_origins" USING btree ("site_id","origin");
--> statement-breakpoint
ALTER TABLE "api_key_sites" ADD CONSTRAINT "api_key_sites_api_key_id_apikey_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."apikey"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_key_sites" ADD CONSTRAINT "api_key_sites_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_reference_id_user_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "site_memberships" ADD CONSTRAINT "site_memberships_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "site_memberships" ADD CONSTRAINT "site_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "site_origins" ADD CONSTRAINT "site_origins_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "api_key_sites_site_id_idx" ON "api_key_sites" USING btree ("site_id");
--> statement-breakpoint
CREATE INDEX "apikey_config_id_idx" ON "apikey" USING btree ("config_id");
--> statement-breakpoint
CREATE INDEX "apikey_reference_id_idx" ON "apikey" USING btree ("reference_id");
--> statement-breakpoint
CREATE INDEX "site_memberships_user_id_idx" ON "site_memberships" USING btree ("user_id");
