CREATE TABLE "instance_admins" (
	"slot" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instance_admins_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "instance_admins_singleton_check" CHECK ("instance_admins"."slot" = 1)
);
--> statement-breakpoint
ALTER TABLE "instance_admins" ADD CONSTRAINT "instance_admins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;