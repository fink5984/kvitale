CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."command_status" AS ENUM('pending', 'delivered', 'succeeded', 'failed', 'expired', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."command_type" AS ENUM('test_print', 'pause', 'resume', 'reboot_agent', 'restart_service', 'clear_error', 'diagnostics', 'config_update', 'ota_update');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('provisioning', 'active', 'maintenance', 'retired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."grave_status" AS ENUM('discovery_only', 'coming_soon', 'active', 'paused', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('pending_payment', 'queued', 'scheduled', 'sending', 'printing', 'printed', 'cut', 'chute_confirmed', 'delivered', 'uncertain', 'failed', 'refunded', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'scheduled', 'leased', 'printing', 'printed', 'cut', 'chute_confirmed', 'delivered', 'uncertain', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'paid', 'in_fulfillment', 'fulfilled', 'attention', 'refunded', 'partially_refunded', 'canceled', 'payment_failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'requires_action', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."permit_status" AS ENUM('none', 'requested', 'approved', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'approved', 'succeeded', 'failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'admin', 'finance', 'support_limited', 'content_editor', 'partner_manager', 'local_maintainer', 'customer');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'waiting_parts', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"severity" "severity" DEFAULT 'warning' NOT NULL,
	"params" jsonb
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"severity" "severity" NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"device_id" uuid,
	"grave_id" uuid,
	"dedupe_key" text NOT NULL,
	"data" jsonb,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_kind" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"meta" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"currency" text,
	"max_redemptions" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currency_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"rate" real NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"grave_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone,
	"asserted_by" uuid,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"type" "command_type" NOT NULL,
	"payload" jsonb,
	"status" "command_status" DEFAULT 'pending' NOT NULL,
	"signature" text NOT NULL,
	"issued_by" uuid,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_config" (
	"device_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"event_uid" text NOT NULL,
	"type" text NOT NULL,
	"severity" "severity" DEFAULT 'info' NOT NULL,
	"job_id" uuid,
	"data" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"grave_id" uuid,
	"device_name" text NOT NULL,
	"printer_profile_id" text,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"device_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial" text NOT NULL,
	"name" text NOT NULL,
	"status" "device_status" DEFAULT 'provisioning' NOT NULL,
	"printer_profile_id" text,
	"agent_version" text,
	"firmware_channel" text DEFAULT 'stable' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_telemetry" jsonb,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_graves" (
	"user_id" uuid NOT NULL,
	"grave_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_graves_user_id_grave_id_pk" PRIMARY KEY("user_id","grave_id")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firmware_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"channel" text DEFAULT 'canary' NOT NULL,
	"sha256" text NOT NULL,
	"signature" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grave_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grave_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"script" text NOT NULL,
	"normalized" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grave_hilulot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grave_id" uuid NOT NULL,
	"hebrew_day" smallint NOT NULL,
	"hebrew_month" smallint NOT NULL,
	"hebrew_year_of_passing" integer,
	"source_note" text,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grave_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grave_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer,
	"height" integer,
	"alt" jsonb,
	"credit" text,
	"license" text,
	"rights_verified" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_text" text NOT NULL,
	"location_text" text,
	"email" text,
	"locale" text,
	"matched_grave_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grave_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grave_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"open_minute" smallint NOT NULL,
	"close_minute" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grave_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grave_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"epithet" text,
	"place_name" text,
	"address" text,
	"bio" text,
	"bio_sources" text,
	"customs" text,
	"meta_title" text,
	"meta_description" text,
	"faq" jsonb,
	"reviewed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"status" "grave_status" DEFAULT 'discovery_only' NOT NULL,
	"location_id" uuid,
	"timezone" text NOT NULL,
	"dynasty" text,
	"era_start_year" smallint,
	"era_end_year" smallint,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"permit_status" "permit_status" DEFAULT 'none' NOT NULL,
	"permit_notes" text,
	"operator_partner_id" uuid,
	"observe_shabbat" boolean DEFAULT true NOT NULL,
	"observe_yom_tov" boolean DEFAULT true NOT NULL,
	"israel_holidays" boolean DEFAULT false NOT NULL,
	"shabbat_cutoff_minute" smallint DEFAULT 720 NOT NULL,
	"demand_count" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kvittel_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kvittel_id" uuid,
	"upload_token" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"encrypted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kvittels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_enc" text,
	"content_digest" text NOT NULL,
	"template" text NOT NULL,
	"nusach" text NOT NULL,
	"page_count" smallint NOT NULL,
	"length_mm" real NOT NULL,
	"layout_version" text NOT NULL,
	"retention_until" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"city_key" text NOT NULL,
	"lat" real,
	"lng" real,
	"verified" boolean DEFAULT false NOT NULL,
	"verification_source" text
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"redirect_to" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_user_id" uuid,
	"note" text NOT NULL,
	"photo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grave_id" uuid,
	"device_id" uuid,
	"alert_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"priority" smallint DEFAULT 2 NOT NULL,
	"assignee_user_id" uuid,
	"due_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"grave_id" uuid NOT NULL,
	"kvittel_id" uuid NOT NULL,
	"pages" smallint DEFAULT 1 NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"extras_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"status" "item_status" DEFAULT 'pending_payment' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"delivery_confidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_tracking_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_ref" text NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"locale" text NOT NULL,
	"currency" text NOT NULL,
	"subtotal_minor" integer NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"coupon_id" uuid,
	"price_snapshot" jsonb NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"country_hint" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"locale" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"meta_description" text,
	"reviewed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'page' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper_rolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"outer_diameter_mm" real NOT NULL,
	"core_diameter_mm" real NOT NULL,
	"thickness_mm" real NOT NULL,
	"nominal_length_mm" integer,
	"used_mm" real DEFAULT 0 NOT NULL,
	"calibration_factor" real,
	"installed_by" uuid,
	"ticket_id" uuid,
	"photo_key" text
);
--> statement-breakpoint
CREATE TABLE "partner_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"revenue_share_bps" integer DEFAULT 0 NOT NULL,
	"fixed_monthly_minor" integer,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_graves" (
	"partner_id" uuid NOT NULL,
	"grave_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_graves_partner_id_grave_id_pk" PRIMARY KEY("partner_id","grave_id")
);
--> statement-breakpoint
CREATE TABLE "partner_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'operator' NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"locale" text DEFAULT 'he' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"payment_id" uuid,
	"signature_valid" boolean NOT NULL,
	"payload_digest" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"outcome" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"fee_minor" integer,
	"refunded_minor" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"succeeded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text DEFAULT 'default' NOT NULL,
	"grave_id" uuid,
	"country_code" text,
	"item" text NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"attempt_no" smallint NOT NULL,
	"lease_id" text NOT NULL,
	"leased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"printed_at" timestamp with time zone,
	"cut_at" timestamp with time zone,
	"chute_at" timestamp with time zone,
	"outcome" text,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid,
	"grave_id" uuid NOT NULL,
	"device_id" uuid,
	"command_id" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"not_before" timestamp with time zone,
	"lease_id" text,
	"lease_expires_at" timestamp with time zone,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"raster_digest" text,
	"length_mm" real,
	"confidence" text,
	"last_error" text,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "printer_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"model" text,
	"dots_per_mm" real NOT NULL,
	"width_dots" integer NOT NULL,
	"capabilities" jsonb NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "proof_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"duration_ms" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"order_item_id" uuid,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'requested' NOT NULL,
	"requested_by" uuid,
	"approved_by" uuid,
	"provider_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"grave_id" uuid,
	"kind" text NOT NULL,
	"hebrew_day" smallint,
	"hebrew_month" smallint,
	"label" text,
	"channel" text DEFAULT 'email' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"partner_id" uuid,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rollouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"percent" smallint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_name" text NOT NULL,
	"content_enc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content_enc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"grave_id" uuid NOT NULL,
	"saved_template_id" uuid,
	"rule" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text,
	"kind" text NOT NULL,
	"granted" boolean NOT NULL,
	"source" text NOT NULL,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"locale" text DEFAULT 'he' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_assignments" ADD CONSTRAINT "device_assignments_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_config" ADD CONSTRAINT "device_config_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_credentials" ADD CONSTRAINT "device_credentials_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pairing_codes" ADD CONSTRAINT "device_pairing_codes_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pairing_codes" ADD CONSTRAINT "device_pairing_codes_printer_profile_id_printer_profiles_id_fk" FOREIGN KEY ("printer_profile_id") REFERENCES "public"."printer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pairing_codes" ADD CONSTRAINT "device_pairing_codes_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_telemetry" ADD CONSTRAINT "device_telemetry_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_printer_profile_id_printer_profiles_id_fk" FOREIGN KEY ("printer_profile_id") REFERENCES "public"."printer_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_graves" ADD CONSTRAINT "favorite_graves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_graves" ADD CONSTRAINT "favorite_graves_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grave_aliases" ADD CONSTRAINT "grave_aliases_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grave_hilulot" ADD CONSTRAINT "grave_hilulot_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grave_media" ADD CONSTRAINT "grave_media_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grave_requests" ADD CONSTRAINT "grave_requests_matched_grave_id_graves_id_fk" FOREIGN KEY ("matched_grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grave_schedules" ADD CONSTRAINT "grave_schedules_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grave_translations" ADD CONSTRAINT "grave_translations_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graves" ADD CONSTRAINT "graves_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graves" ADD CONSTRAINT "graves_operator_partner_id_partners_id_fk" FOREIGN KEY ("operator_partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kvittel_files" ADD CONSTRAINT "kvittel_files_kvittel_id_kvittels_id_fk" FOREIGN KEY ("kvittel_id") REFERENCES "public"."kvittels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_kvittel_id_kvittels_id_fk" FOREIGN KEY ("kvittel_id") REFERENCES "public"."kvittels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_tracking_tokens" ADD CONSTRAINT "order_tracking_tokens_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translations" ADD CONSTRAINT "page_translations_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_rolls" ADD CONSTRAINT "paper_rolls_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_agreements" ADD CONSTRAINT "partner_agreements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_graves" ADD CONSTRAINT "partner_graves_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_graves" ADD CONSTRAINT "partner_graves_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_attempts" ADD CONSTRAINT "print_attempts_job_id_print_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."print_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_attempts" ADD CONSTRAINT "print_attempts_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_media" ADD CONSTRAINT "proof_media_job_id_print_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."print_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_subscriptions" ADD CONSTRAINT "reminder_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_subscriptions" ADD CONSTRAINT "reminder_subscriptions_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollouts" ADD CONSTRAINT "rollouts_release_id_firmware_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."firmware_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_people" ADD CONSTRAINT "saved_people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_templates" ADD CONSTRAINT "saved_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_deliveries" ADD CONSTRAINT "scheduled_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_deliveries" ADD CONSTRAINT "scheduled_deliveries_grave_id_graves_id_fk" FOREIGN KEY ("grave_id") REFERENCES "public"."graves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_deliveries" ADD CONSTRAINT "scheduled_deliveries_saved_template_id_saved_templates_id_fk" FOREIGN KEY ("saved_template_id") REFERENCES "public"."saved_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_open_dedupe_uq" ON "alerts" USING btree ("dedupe_key") WHERE status <> 'resolved';--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_uq" ON "coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "device_assignments_grave_idx" ON "device_assignments" USING btree ("grave_id");--> statement-breakpoint
CREATE INDEX "device_assignments_device_idx" ON "device_assignments" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_commands_device_status_idx" ON "device_commands" USING btree ("device_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "device_credentials_hash_uq" ON "device_credentials" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "device_events_uid_uq" ON "device_events" USING btree ("device_id","event_uid");--> statement-breakpoint
CREATE INDEX "device_events_device_idx" ON "device_events" USING btree ("device_id","occurred_at");--> statement-breakpoint
CREATE INDEX "device_telemetry_device_at_idx" ON "device_telemetry" USING btree ("device_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_serial_uq" ON "devices" USING btree ("serial");--> statement-breakpoint
CREATE INDEX "grave_aliases_norm_idx" ON "grave_aliases" USING btree ("normalized");--> statement-breakpoint
CREATE INDEX "grave_aliases_grave_idx" ON "grave_aliases" USING btree ("grave_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grave_translations_uq" ON "grave_translations" USING btree ("grave_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "graves_slug_uq" ON "graves" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "graves_status_idx" ON "graves" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "magic_links_token_uq" ON "magic_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "magic_links_email_idx" ON "magic_links" USING btree ("email");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "maintenance_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_grave_idx" ON "order_items" USING btree ("grave_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_token_uq" ON "order_tracking_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_ref_uq" ON "orders" USING btree ("public_ref");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_email_idx" ON "orders" USING btree ("email");--> statement-breakpoint
CREATE INDEX "outbound_emails_to_idx" ON "outbound_emails" USING btree ("to");--> statement-breakpoint
CREATE UNIQUE INDEX "page_translations_uq" ON "page_translations" USING btree ("page_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_uq" ON "pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "paper_rolls_device_idx" ON "paper_rolls" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_uq" ON "payment_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_uq" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "prices_lookup_idx" ON "prices" USING btree ("item","currency","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "print_attempts_lease_uq" ON "print_attempts" USING btree ("lease_id");--> statement-breakpoint
CREATE UNIQUE INDEX "print_jobs_command_uq" ON "print_jobs" USING btree ("command_id");--> statement-breakpoint
CREATE INDEX "print_jobs_status_idx" ON "print_jobs" USING btree ("status","grave_id");--> statement-breakpoint
CREATE INDEX "print_jobs_device_idx" ON "print_jobs" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "role_assignments_user_idx" ON "role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_consents_user_idx" ON "user_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_consents_email_idx" ON "user_consents" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");