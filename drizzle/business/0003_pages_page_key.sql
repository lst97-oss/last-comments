ALTER TABLE "pages" ADD COLUMN "page_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_pagekey_uq" ON "pages" USING btree ("site_id","page_key") WHERE "pages"."page_key" is not null;