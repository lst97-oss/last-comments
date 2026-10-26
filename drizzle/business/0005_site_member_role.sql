-- Site roles are admin (manages the site) and member (comments only). The moderator
-- role was never assigned by the application, so any existing row becomes a member.
ALTER TABLE "site_memberships" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
UPDATE "site_memberships" SET "role" = 'member' WHERE "role" = 'moderator';--> statement-breakpoint
DROP TYPE "public"."site_role";--> statement-breakpoint
CREATE TYPE "public"."site_role" AS ENUM('admin', 'member');--> statement-breakpoint
ALTER TABLE "site_memberships" ALTER COLUMN "role" SET DATA TYPE "public"."site_role" USING "role"::"public"."site_role";
