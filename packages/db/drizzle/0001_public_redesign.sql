ALTER TABLE "grave_media" ADD COLUMN "role" text DEFAULT 'gallery' NOT NULL;--> statement-breakpoint
ALTER TABLE "grave_media" ADD COLUMN "focal_x" smallint DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "grave_media" ADD COLUMN "focal_y" smallint DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "checkout_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idem_uq" ON "orders" USING btree ("idempotency_key");