CREATE TABLE "comment_reactions" (
	"comment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_comment_id_user_id_emoji_pk" PRIMARY KEY("comment_id","user_id","emoji"),
	CONSTRAINT "comment_reactions_emoji_check" CHECK (char_length("comment_reactions"."emoji") between 1 and 16)
);
--> statement-breakpoint
CREATE TABLE "page_reactions" (
	"page_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_reactions_page_id_user_id_emoji_pk" PRIMARY KEY("page_id","user_id","emoji"),
	CONSTRAINT "page_reactions_emoji_check" CHECK (char_length("page_reactions"."emoji") between 1 and 16)
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "page_reactions_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "comment_reactions_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_reactions" ADD CONSTRAINT "page_reactions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_reactions" ADD CONSTRAINT "page_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_reactions_user_id_idx" ON "comment_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "page_reactions_user_id_idx" ON "page_reactions" USING btree ("user_id");