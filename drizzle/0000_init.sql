CREATE TYPE "public"."audit_event_type" AS ENUM('QUOTE_ISSUED', 'QUOTE_APPROVED', 'QUOTE_DECLINED', 'UNSAFE_VEHICLE_REFUSAL', 'ESTIMATE_PLANNED', 'RESOLVED_ELSEWHERE', 'INVOICE_PUBLISHED', 'FINDING_PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('OPEN', 'QUOTE_REQUESTED', 'QUOTED', 'APPROVED', 'BOOKED', 'PLANNED', 'DECLINED', 'RESOLVED_ELSEWHERE', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."payment_rail" AS ENUM('PAYTO', 'CARD', 'APPLE_PAY', 'GOOGLE_PAY', 'BNPL_AFTERPAY', 'BNPL_ZIP');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('ISSUED', 'APPROVED', 'DECLINED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PUBLISHED', 'PENDING_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('URGENT_RED', 'WATCH_AMBER', 'HEALTHY_GREEN');--> statement-breakpoint
CREATE TABLE "adapter_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid,
	"port" text NOT NULL,
	"operation" text NOT NULL,
	"seq" integer NOT NULL,
	"mode" text NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"customer_id" uuid,
	"service_type" text NOT NULL,
	"finding_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requested_date" date NOT NULL,
	"drop_off" text NOT NULL,
	"loan_car" boolean DEFAULT false NOT NULL,
	"notes" text,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"mobile" text NOT NULL,
	"email" text,
	"address_line" text,
	"suburb" text,
	"postcode" text,
	"role" text DEFAULT 'MEMBER' NOT NULL,
	"sms_opt_in" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"inspection_report_id" uuid,
	"severity" "severity" NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"customer_explanation" text NOT NULL,
	"technician_note" text,
	"measurement" text,
	"diagram" text,
	"horizon_text" text,
	"horizon_km" integer,
	"horizon_date" date,
	"estimate_low_cents" integer,
	"estimate_high_cents" integer,
	"safety_critical" boolean DEFAULT false NOT NULL,
	"status" "finding_status" DEFAULT 'OPEN' NOT NULL,
	"review_status" "review_status" DEFAULT 'PUBLISHED' NOT NULL,
	"planned_horizon" text,
	"planned_remind_at" timestamp with time zone,
	"resolved_note" text,
	"source" text DEFAULT 'TECH' NOT NULL,
	"annotation" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "findings_estimate_range_ck" CHECK ("findings"."estimate_low_cents" IS NULL OR "findings"."estimate_high_cents" IS NULL OR "findings"."estimate_low_cents" <= "findings"."estimate_high_cents")
);
--> statement-breakpoint
CREATE TABLE "fixed_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"quote_number" text NOT NULL,
	"title" text NOT NULL,
	"finding_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mod_quote_request_id" uuid,
	"line_items" jsonb NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"gst_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"valid_until" date NOT NULL,
	"status" "quote_status" DEFAULT 'ISSUED' NOT NULL,
	"issued_by" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"approved_line_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"steps" jsonb NOT NULL,
	"extracted" jsonb NOT NULL,
	"confidence" real NOT NULL,
	"vehicle_id" uuid,
	"service_record_id" uuid,
	"media_key" text,
	"review_seconds" real,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"service_record_id" uuid,
	"inspected_at" timestamp with time zone NOT NULL,
	"odometer_km" integer NOT NULL,
	"technician_name" text NOT NULL,
	"summary" text,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"data_base64" text,
	"vehicle_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"thread" text DEFAULT 'VEHICLE' NOT NULL,
	"mod_quote_request_id" uuid,
	"quote_id" uuid,
	"author_role" text NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"channel" text DEFAULT 'APP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"customer_id" uuid,
	"mod_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"usage" text,
	"budget_band" text,
	"vin_snapshot" text NOT NULL,
	"variant_snapshot" text NOT NULL,
	"photo_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"product_link" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nevdis_lookups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"rego_state" text NOT NULL,
	"rego" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"quote_id" uuid,
	"rail" "payment_rail" NOT NULL,
	"amount_cents" integer NOT NULL,
	"workshop_fee_cents" integer NOT NULL,
	"surcharge_cents" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"provider_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_no_surcharge_ck" CHECK ("payments"."surcharge_cents" = 0),
	CONSTRAINT "payments_amount_positive_ck" CHECK ("payments"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "quotes_and_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"event_type" "audit_event_type" NOT NULL,
	"vehicle_id" uuid,
	"finding_id" uuid,
	"quote_id" uuid,
	"actor_role" text NOT NULL,
	"signer_name" text,
	"signature_svg" text,
	"acknowledgements" jsonb,
	"payload" jsonb NOT NULL,
	"prev_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"finding_id" uuid,
	"customer_id" uuid,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"message" text NOT NULL,
	"campaign_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"source" text NOT NULL,
	"service_date" date NOT NULL,
	"odometer_km" integer NOT NULL,
	"summary" text NOT NULL,
	"line_items" jsonb NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"gst_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"technician_name" text NOT NULL,
	"advisor_name" text,
	"verified" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" text,
	"pdf_path" text,
	"payment_note" text,
	"ingestion_job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"primary_driver_id" uuid,
	"rego" text NOT NULL,
	"rego_state" text NOT NULL,
	"rego_expiry" date NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"variant" text NOT NULL,
	"year" integer NOT NULL,
	"vin" text NOT NULL,
	"colour" text NOT NULL,
	"body_type" text NOT NULL,
	"engine" text NOT NULL,
	"transmission" text NOT NULL,
	"odometer_km" integer NOT NULL,
	"odometer_at" timestamp with time zone NOT NULL,
	"avg_km_per_day" real NOT NULL,
	"next_service_due_date" date,
	"next_service_due_km" integer,
	"nickname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"pass_type_identifier" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"last_push_at" timestamp with time zone,
	"last_push_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"owner_names" text NOT NULL,
	"staff_count" integer NOT NULL,
	"address_line" text NOT NULL,
	"suburb" text NOT NULL,
	"state" text NOT NULL,
	"postcode" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"abn" text NOT NULL,
	"licence_state" text NOT NULL,
	"licence_type" text NOT NULL,
	"licence_number" text NOT NULL,
	"wms" text NOT NULL,
	"brand_primary" text NOT NULL,
	"brand_accent" text NOT NULL,
	"sms_sender_id" text NOT NULL,
	"hours_text" text NOT NULL,
	"labour_rate_cents" integer NOT NULL,
	"bay_count" integer DEFAULT 4 NOT NULL,
	"payto_enabled" boolean DEFAULT true NOT NULL,
	"card_enabled" boolean DEFAULT true NOT NULL,
	"bnpl_enabled" boolean DEFAULT false NOT NULL,
	"bnpl_min_cents" integer DEFAULT 60000 NOT NULL,
	"auto_publish_threshold" real DEFAULT 0.98 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adapter_events" ADD CONSTRAINT "adapter_events_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_inspection_report_id_inspection_reports_id_fk" FOREIGN KEY ("inspection_report_id") REFERENCES "public"."inspection_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_quotes" ADD CONSTRAINT "fixed_quotes_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_quotes" ADD CONSTRAINT "fixed_quotes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_quotes" ADD CONSTRAINT "fixed_quotes_mod_quote_request_id_mod_quote_requests_id_fk" FOREIGN KEY ("mod_quote_request_id") REFERENCES "public"."mod_quote_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_reports" ADD CONSTRAINT "inspection_reports_service_record_id_service_records_id_fk" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_mod_quote_request_id_mod_quote_requests_id_fk" FOREIGN KEY ("mod_quote_request_id") REFERENCES "public"."mod_quote_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_quote_id_fixed_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fixed_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mod_quote_requests" ADD CONSTRAINT "mod_quote_requests_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mod_quote_requests" ADD CONSTRAINT "mod_quote_requests_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mod_quote_requests" ADD CONSTRAINT "mod_quote_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nevdis_lookups" ADD CONSTRAINT "nevdis_lookups_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_fixed_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."fixed_quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes_and_approvals" ADD CONSTRAINT "quotes_and_approvals_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_primary_driver_id_customers_id_fk" FOREIGN KEY ("primary_driver_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_passes" ADD CONSTRAINT "wallet_passes_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_passes" ADD CONSTRAINT "wallet_passes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adapter_events_workshop_idx" ON "adapter_events" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "adapter_events_port_idx" ON "adapter_events" USING btree ("port","seq");--> statement-breakpoint
CREATE INDEX "bookings_workshop_idx" ON "bookings" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "bookings_vehicle_idx" ON "bookings" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "customers_workshop_idx" ON "customers" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "customers_household_idx" ON "customers" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "findings_workshop_idx" ON "findings" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "findings_vehicle_idx" ON "findings" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "fixed_quotes_workshop_idx" ON "fixed_quotes" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "fixed_quotes_vehicle_idx" ON "fixed_quotes" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fixed_quotes_number_uq" ON "fixed_quotes" USING btree ("workshop_id","quote_number");--> statement-breakpoint
CREATE INDEX "households_workshop_idx" ON "households" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "ingestion_jobs_workshop_idx" ON "ingestion_jobs" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "inspection_reports_workshop_idx" ON "inspection_reports" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "inspection_reports_vehicle_idx" ON "inspection_reports" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "media_assets_workshop_idx" ON "media_assets" USING btree ("workshop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_key_uq" ON "media_assets" USING btree ("key");--> statement-breakpoint
CREATE INDEX "messages_workshop_idx" ON "messages" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "messages_vehicle_idx" ON "messages" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "mod_quote_requests_workshop_idx" ON "mod_quote_requests" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "mod_quote_requests_vehicle_idx" ON "mod_quote_requests" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "nevdis_lookups_workshop_idx" ON "nevdis_lookups" USING btree ("workshop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nevdis_lookups_uq" ON "nevdis_lookups" USING btree ("workshop_id","rego_state","rego");--> statement-breakpoint
CREATE INDEX "payments_workshop_idx" ON "payments" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "quotes_and_approvals_workshop_idx" ON "quotes_and_approvals" USING btree ("workshop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_and_approvals_seq_uq" ON "quotes_and_approvals" USING btree ("workshop_id","seq");--> statement-breakpoint
CREATE INDEX "reminders_workshop_idx" ON "reminders" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "reminders_vehicle_idx" ON "reminders" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "service_records_workshop_idx" ON "service_records" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "service_records_vehicle_idx" ON "service_records" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_records_invoice_uq" ON "service_records" USING btree ("workshop_id","invoice_number");--> statement-breakpoint
CREATE INDEX "vehicles_workshop_idx" ON "vehicles" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "vehicles_household_idx" ON "vehicles" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_rego_uq" ON "vehicles" USING btree ("workshop_id","rego_state","rego");--> statement-breakpoint
CREATE INDEX "wallet_passes_workshop_idx" ON "wallet_passes" USING btree ("workshop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_passes_vehicle_uq" ON "wallet_passes" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workshops_slug_uq" ON "workshops" USING btree ("slug");