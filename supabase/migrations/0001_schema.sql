-- R2M CONNECT — 0001: core schema (tables, keys, indexes, sequences)
-- Generated from src/db/schema.ts. Safe to re-run: uses IF NOT EXISTS and never drops data.
-- Review before executing in the Supabase SQL editor. users.id is intended to equal auth.users.id.

CREATE SEQUENCE IF NOT EXISTS "public"."application_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;
CREATE SEQUENCE IF NOT EXISTS "public"."membership_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;
CREATE SEQUENCE IF NOT EXISTS "public"."order_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;
CREATE SEQUENCE IF NOT EXISTS "public"."receipt_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;
CREATE TABLE IF NOT EXISTS "association_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "blood_donors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"blood_group" text NOT NULL,
	"district_id" uuid,
	"mandal_id" uuid,
	"location" text,
	"available" boolean DEFAULT true NOT NULL,
	"consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "blood_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"blood_group" text NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"hospital" text NOT NULL,
	"district_id" uuid,
	"mandal_id" uuid,
	"contact_phone" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text DEFAULT 'percent' NOT NULL,
	"value" integer NOT NULL,
	"min_order_paise" integer DEFAULT 0 NOT NULL,
	"max_discount_paise" integer,
	"usage_limit" integer,
	"used" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "districts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "districts_name_unique" UNIQUE("name")
);

CREATE TABLE IF NOT EXISTS "emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"phone" text NOT NULL,
	"kind" text DEFAULT 'association' NOT NULL,
	"district_id" uuid,
	"active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "emergency_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"message" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"status" text DEFAULT 'submitted' NOT NULL,
	"assigned_to" uuid,
	"response_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'meeting' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"venue" text,
	"district_id" uuid,
	"mandal_id" uuid,
	"organizer" text,
	"contact" text,
	"image_url" text,
	"status" text DEFAULT 'published' NOT NULL,
	"registration_open" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"amount_paise" integer NOT NULL,
	"spent_on" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "mandals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "manual_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"collected_by" uuid NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"transaction_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "member_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"doc_type" text NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"application_ref" text NOT NULL,
	"membership_no" text,
	"full_name" text NOT NULL,
	"mobile" text NOT NULL,
	"email" text,
	"dob" date,
	"photo_url" text,
	"address" text,
	"village" text,
	"district_id" uuid,
	"mandal_id" uuid,
	"workshop_name" text,
	"workshop_address" text,
	"experience_years" integer,
	"specialization" text,
	"services" text,
	"working_hours" text,
	"emergency_name" text,
	"emergency_phone" text,
	"nominee_name" text,
	"nominee_relation" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"agent_id" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"valid_from" date,
	"valid_till" date,
	"directory_opt_in" boolean DEFAULT false NOT NULL,
	"directory_verified" boolean DEFAULT false NOT NULL,
	"plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "membership_card_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"action" text NOT NULL,
	"note" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "membership_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "membership_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"joining_fee_paise" integer DEFAULT 0 NOT NULL,
	"application_fee_paise" integer DEFAULT 0 NOT NULL,
	"renewal_fee_paise" integer DEFAULT 0 NOT NULL,
	"late_fee_paise" integer DEFAULT 0 NOT NULL,
	"grace_days" integer DEFAULT 30 NOT NULL,
	"validity_months" integer DEFAULT 12 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "membership_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"plan_id" uuid,
	"transaction_id" uuid,
	"kind" text DEFAULT 'renewal' NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"amount_paise" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"image_url" text,
	"attachment_url" text,
	"status" text DEFAULT 'published' NOT NULL,
	"publish_at" timestamp with time zone DEFAULT now() NOT NULL,
	"district_id" uuid,
	"mandal_id" uuid,
	"author_id" uuid,
	"is_notice" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"kind" text DEFAULT 'general' NOT NULL,
	"channel_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_paise" integer NOT NULL,
	"gst_rate" integer DEFAULT 0 NOT NULL,
	"hsn" text
);

CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" text NOT NULL,
	"user_id" uuid NOT NULL,
	"member_id" uuid,
	"status" text DEFAULT 'payment_pending' NOT NULL,
	"payment_method" text DEFAULT 'online' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"fulfilment" text DEFAULT 'delivery' NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"delivery_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"gst_paise" integer DEFAULT 0 NOT NULL,
	"coupon_code" text,
	"address" jsonb NOT NULL,
	"stock_deducted" boolean DEFAULT false NOT NULL,
	"invoice_no" text,
	"checkout_key" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no"),
	CONSTRAINT "orders_checkout_key_unique" UNIQUE("checkout_key")
);

CREATE TABLE IF NOT EXISTS "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text DEFAULT 'reset' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"member_id" uuid,
	"user_id" uuid,
	"order_id" uuid,
	"amount_paise" integer NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"gateway_order_id" text,
	"gateway_payment_id" text,
	"receipt_no" text,
	"purpose" text,
	"plan_id" uuid,
	"collected_by" uuid,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "product_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_brands_name_unique" UNIQUE("name")
);

CREATE TABLE IF NOT EXISTS "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_categories_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "product_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid,
	"brand_id" uuid,
	"manufacturer" text,
	"description" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mrp_paise" integer NOT NULL,
	"price_paise" integer NOT NULL,
	"gst_rate" integer DEFAULT 18 NOT NULL,
	"hsn" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 5 NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"specs" text,
	"warranty" text,
	"weight_grams" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sold_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);

CREATE TABLE IF NOT EXISTS "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid,
	"order_id" uuid,
	"amount_paise" integer NOT NULL,
	"reason" text,
	"method" text DEFAULT 'manual' NOT NULL,
	"reference" text,
	"gateway_refund_id" text,
	"processed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "roles" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scope" text DEFAULT 'global' NOT NULL,
	"level" integer DEFAULT 50 NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" text NOT NULL,
	"qty" integer NOT NULL,
	"reason" text NOT NULL,
	"source" text,
	"ref_id" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reply" text,
	"replied_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_key" text NOT NULL,
	"district_id" uuid,
	"mandal_id" uuid,
	"employee_id" text,
	"reporting_officer_id" uuid,
	"joining_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"mobile" text,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"photo_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "welfare_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_no" text NOT NULL,
	"scheme_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"requested_paise" integer,
	"approved_paise" integer,
	"emergency_contact" text,
	"consent" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"current_stage" text DEFAULT 'review' NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decision_reason" text,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "welfare_applications_ref_no_unique" UNIQUE("ref_no")
);

CREATE TABLE IF NOT EXISTS "welfare_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"decision" text NOT NULL,
	"comment" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "welfare_disbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"disbursed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "welfare_schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"description" text,
	"max_amount_paise" integer,
	"approval_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blood_donors_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "blood_donors" ADD CONSTRAINT "blood_donors_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blood_donors_district_id_districts_id_fk') THEN EXECUTE 'ALTER TABLE "blood_donors" ADD CONSTRAINT "blood_donors_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blood_donors_mandal_id_mandals_id_fk') THEN EXECUTE 'ALTER TABLE "blood_donors" ADD CONSTRAINT "blood_donors_mandal_id_mandals_id_fk" FOREIGN KEY ("mandal_id") REFERENCES "public"."mandals"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blood_requests_requester_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blood_requests_district_id_districts_id_fk') THEN EXECUTE 'ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blood_requests_mandal_id_mandals_id_fk') THEN EXECUTE 'ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_mandal_id_mandals_id_fk" FOREIGN KEY ("mandal_id") REFERENCES "public"."mandals"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_user_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_product_id_products_id_fk') THEN EXECUTE 'ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_contacts_district_id_districts_id_fk') THEN EXECUTE 'ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_requests_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_requests_assigned_to_users_id_fk') THEN EXECUTE 'ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_registrations_event_id_events_id_fk') THEN EXECUTE 'ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_registrations_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_district_id_districts_id_fk') THEN EXECUTE 'ALTER TABLE "events" ADD CONSTRAINT "events_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_mandal_id_mandals_id_fk') THEN EXECUTE 'ALTER TABLE "events" ADD CONSTRAINT "events_mandal_id_mandals_id_fk" FOREIGN KEY ("mandal_id") REFERENCES "public"."mandals"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_created_by_users_id_fk') THEN EXECUTE 'ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mandals_district_id_districts_id_fk') THEN EXECUTE 'ALTER TABLE "mandals" ADD CONSTRAINT "mandals_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manual_collections_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "manual_collections" ADD CONSTRAINT "manual_collections_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_documents_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "member_documents" ADD CONSTRAINT "member_documents_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_user_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_district_id_districts_id_fk') THEN EXECUTE 'ALTER TABLE "members" ADD CONSTRAINT "members_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_mandal_id_mandals_id_fk') THEN EXECUTE 'ALTER TABLE "members" ADD CONSTRAINT "members_mandal_id_mandals_id_fk" FOREIGN KEY ("mandal_id") REFERENCES "public"."mandals"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_agent_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "members" ADD CONSTRAINT "members_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_approved_by_users_id_fk') THEN EXECUTE 'ALTER TABLE "members" ADD CONSTRAINT "members_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_card_history_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "membership_card_history" ADD CONSTRAINT "membership_card_history_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_cards_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "membership_cards" ADD CONSTRAINT "membership_cards_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_renewals_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "membership_renewals" ADD CONSTRAINT "membership_renewals_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_renewals_plan_id_membership_plans_id_fk') THEN EXECUTE 'ALTER TABLE "membership_renewals" ADD CONSTRAINT "membership_renewals_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_district_id_districts_id_fk') THEN EXECUTE 'ALTER TABLE "news" ADD CONSTRAINT "news_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_mandal_id_mandals_id_fk') THEN EXECUTE 'ALTER TABLE "news" ADD CONSTRAINT "news_mandal_id_mandals_id_fk" FOREIGN KEY ("mandal_id") REFERENCES "public"."mandals"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_author_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "news" ADD CONSTRAINT "news_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_orders_id_fk') THEN EXECUTE 'ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_product_id_products_id_fk') THEN EXECUTE 'ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "orders" ADD CONSTRAINT "orders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'password_resets_user_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_transactions_user_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_returns_order_id_orders_id_fk') THEN EXECUTE 'ALTER TABLE "product_returns" ADD CONSTRAINT "product_returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_product_categories_id_fk') THEN EXECUTE 'ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_brand_id_product_brands_id_fk') THEN EXECUTE 'ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_product_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."product_brands"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_product_id_products_id_fk') THEN EXECUTE 'ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_user_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_role_key_roles_key_fk') THEN EXECUTE 'ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_key_roles_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."roles"("key") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_district_id_districts_id_fk') THEN EXECUTE 'ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_mandal_id_mandals_id_fk') THEN EXECUTE 'ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_mandal_id_mandals_id_fk" FOREIGN KEY ("mandal_id") REFERENCES "public"."mandals"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_reporting_officer_id_users_id_fk') THEN EXECUTE 'ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_reporting_officer_id_users_id_fk" FOREIGN KEY ("reporting_officer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'welfare_applications_scheme_id_welfare_schemes_id_fk') THEN EXECUTE 'ALTER TABLE "welfare_applications" ADD CONSTRAINT "welfare_applications_scheme_id_welfare_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."welfare_schemes"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'welfare_applications_member_id_members_id_fk') THEN EXECUTE 'ALTER TABLE "welfare_applications" ADD CONSTRAINT "welfare_applications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'welfare_approvals_application_id_welfare_applications_id_fk') THEN EXECUTE 'ALTER TABLE "welfare_approvals" ADD CONSTRAINT "welfare_approvals_application_id_welfare_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."welfare_applications"("id") ON DELETE cascade ON UPDATE no action'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'welfare_disbursements_application_id_welfare_applications_id_fk') THEN EXECUTE 'ALTER TABLE "welfare_disbursements" ADD CONSTRAINT "welfare_disbursements_application_id_welfare_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."welfare_applications"("id") ON DELETE no action ON UPDATE no action'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "audit_created_idx" ON "audit_logs" USING btree ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "donor_member_uq" ON "blood_donors" USING btree ("member_id");
CREATE UNIQUE INDEX IF NOT EXISTS "cart_uq" ON "cart_items" USING btree ("user_id","product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "event_reg_uq" ON "event_registrations" USING btree ("event_id","member_id");
CREATE INDEX IF NOT EXISTS "events_start_idx" ON "events" USING btree ("starts_at");
CREATE INDEX IF NOT EXISTS "login_attempts_idx" ON "login_attempts" USING btree ("identifier","created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "mandals_district_name_uq" ON "mandals" USING btree ("district_id","name");
CREATE UNIQUE INDEX IF NOT EXISTS "members_no_uq" ON "members" USING btree ("membership_no");
CREATE UNIQUE INDEX IF NOT EXISTS "members_ref_uq" ON "members" USING btree ("application_ref");
CREATE UNIQUE INDEX IF NOT EXISTS "members_mobile_uq" ON "members" USING btree ("mobile");
CREATE INDEX IF NOT EXISTS "members_district_idx" ON "members" USING btree ("district_id");
CREATE INDEX IF NOT EXISTS "members_mandal_idx" ON "members" USING btree ("mandal_id");
CREATE INDEX IF NOT EXISTS "members_status_idx" ON "members" USING btree ("status");
CREATE INDEX IF NOT EXISTS "members_agent_idx" ON "members" USING btree ("agent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "cards_token_uq" ON "membership_cards" USING btree ("token");
CREATE UNIQUE INDEX IF NOT EXISTS "cards_member_uq" ON "membership_cards" USING btree ("member_id");
CREATE INDEX IF NOT EXISTS "news_publish_idx" ON "news" USING btree ("publish_at");
CREATE INDEX IF NOT EXISTS "notif_user_idx" ON "notifications" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "orders_user_idx" ON "orders" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" USING btree ("status");
CREATE INDEX IF NOT EXISTS "pay_member_idx" ON "payment_transactions" USING btree ("member_id");
CREATE INDEX IF NOT EXISTS "pay_status_idx" ON "payment_transactions" USING btree ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "pay_gateway_payment_uq" ON "payment_transactions" USING btree ("gateway_payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pay_receipt_uq" ON "payment_transactions" USING btree ("receipt_no");
CREATE INDEX IF NOT EXISTS "products_cat_idx" ON "products" USING btree ("category_id");
CREATE INDEX IF NOT EXISTS "products_status_idx" ON "products" USING btree ("status");
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_uq" ON "user_roles" USING btree ("user_id","role_key");
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uq" ON "users" USING btree ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_mobile_uq" ON "users" USING btree ("mobile");
CREATE INDEX IF NOT EXISTS "welfare_member_idx" ON "welfare_applications" USING btree ("member_id");
CREATE INDEX IF NOT EXISTS "welfare_status_idx" ON "welfare_applications" USING btree ("status");
