-- Threads and comments: a page per canonical URL or page key, the comments on it (each carrying its
-- site, enforced by a composite foreign key to the page), and one vote per user per comment.
CREATE TYPE "public"."comment_status" AS ENUM('visible', 'hidden', 'deleted');
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"parent_id" uuid,
	"user_id" text,
	"author_name" text NOT NULL,
	"body_markdown" text NOT NULL,
	"status" "comment_status" DEFAULT 'visible' NOT NULL,
	"pinned_at" timestamp with time zone,
	"pinned_by_user_id" text,
	"edit_key_hash" text,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_id_page_uq" UNIQUE("id","page_id"),
	CONSTRAINT "comments_deleted_state_check" CHECK (("comments"."status" = 'deleted') = ("comments"."deleted_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"canonical_url" text NOT NULL,
	"page_key" text,
	"title" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"comment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id"),
	CONSTRAINT "votes_value_check" CHECK ("votes"."value" in (-1, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pages_id_site_uq" ON "pages" USING btree ("id","site_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_url_uq" ON "pages" USING btree ("site_id","canonical_url");
--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_pagekey_uq" ON "pages" USING btree ("site_id","page_key") WHERE "pages"."page_key" is not null;
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_pinned_by_user_id_user_id_fk" FOREIGN KEY ("pinned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_same_page_fk" FOREIGN KEY ("parent_id","page_id") REFERENCES "public"."comments"("id","page_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_page_same_site_fk" FOREIGN KEY ("page_id","site_id") REFERENCES "public"."pages"("id","site_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_locked_by_user_id_user_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "comments_page_created_idx" ON "comments" USING btree ("page_id","created_at","id");
--> statement-breakpoint
CREATE INDEX "comments_parent_created_idx" ON "comments" USING btree ("parent_id","created_at","id");
--> statement-breakpoint
CREATE INDEX "comments_site_created_idx" ON "comments" USING btree ("site_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "comments_site_takedown_idx" ON "comments" USING btree ("site_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "comments"."status" <> 'visible';
--> statement-breakpoint
CREATE INDEX "comments_user_created_idx" ON "comments" USING btree ("user_id","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "votes_user_id_idx" ON "votes" USING btree ("user_id");
