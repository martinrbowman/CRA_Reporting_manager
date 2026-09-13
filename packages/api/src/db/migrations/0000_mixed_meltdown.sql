DO $$ BEGIN
 CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'superseded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."cra_report_status" AS ENUM('draft', 'pending_approval', 'submitted', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."cra_report_type" AS ENUM('early_warning', 'full_notification', 'final_report');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."exploitation_status" AS ENUM('unknown', 'possible', 'confirmed', 'actively_exploited');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_delivery_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'superseded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_type" AS ENUM('customer', 'regulator', 'internal', 'supplier');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_class" AS ENUM('default', 'important1', 'important2', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."product_type" AS ENUM('hardware', 'software', 'firmware', 'mixed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."release_status" AS ENUM('planned', 'building', 'signed', 'released', 'rolled_back', 'withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."release_type" AS ENUM('major', 'minor', 'patch', 'security', 'hotfix');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."severity_level" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."triage_status" AS ENUM('new', 'acknowledged', 'triaged', 'reproduced', 'false_positive', 'validated', 'mitigating', 'fixed', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'disabled', 'pending');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"approval_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"object_type" text NOT NULL,
	"object_id" uuid NOT NULL,
	"approval_type" text NOT NULL,
	"requested_by" text NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decision_date_utc" timestamp with time zone,
	"rationale" text,
	"evidence_reference" text,
	"delegated" boolean DEFAULT false NOT NULL,
	"delegated_from" text,
	"expiry_date" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"audit_event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"event_timestamp_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"details" jsonb,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cra_reports" (
	"report_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_type" "cra_report_type" NOT NULL,
	"status" "cra_report_status" DEFAULT 'draft' NOT NULL,
	"vulnerability_id" uuid,
	"incident_id" uuid,
	"psirt_case_id" uuid,
	"product_id" uuid,
	"regulator" text,
	"reference_number" text,
	"deadline_utc" timestamp with time zone,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_by" text,
	"approved_by" text,
	"submitted_at_utc" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incidents" (
	"incident_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"related_vulnerability_id" uuid,
	"affected_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"detection_date_utc" timestamp with time zone NOT NULL,
	"confirmation_date_utc" timestamp with time zone,
	"incident_category" text NOT NULL,
	"severity" "severity_level" NOT NULL,
	"exploitation_method" text,
	"impacted_systems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"containment_actions" text,
	"eradication_actions" text,
	"recovery_actions" text,
	"forensic_evidence" text,
	"root_cause" text,
	"lessons_learned" text,
	"regulator_notified" boolean DEFAULT false NOT NULL,
	"customer_notified" boolean DEFAULT false NOT NULL,
	"closure_date_utc" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "manufacturers" (
	"manufacturer_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text,
	"eu_establishment_country" text,
	"main_establishment_address" text,
	"contact_email" text,
	"contact_phone" text,
	"responsible_person_eu" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"notification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vulnerability_id" uuid,
	"incident_id" uuid,
	"notification_type" "notification_type" NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient" text,
	"sent_at_utc" timestamp with time zone NOT NULL,
	"channel" text,
	"subject" text,
	"body" text,
	"delivery_status" "notification_delivery_status" DEFAULT 'queued' NOT NULL,
	"delivery_receipt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patches" (
	"patch_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vulnerability_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"version_id" uuid,
	"fix_version_id" uuid,
	"patch_type" text NOT NULL,
	"implementation_reference" text,
	"test_plan" text,
	"test_evidence" text,
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"release_date_utc" timestamp with time zone,
	"distribution_method" text,
	"rollout_plan" text,
	"rollout_status" text,
	"rollback_plan" text,
	"advisory_reference" text,
	"customer_instructions" text,
	"verification_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_versions" (
	"version_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"version_string" text NOT NULL,
	"build_number" text,
	"commit_hash" text,
	"build_date_utc" timestamp with time zone,
	"release_type" "release_type" NOT NULL,
	"release_status" "release_status" DEFAULT 'planned' NOT NULL,
	"release_notes" text,
	"is_eol" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"product_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manufacturer_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"model_number" text,
	"sku" text,
	"product_class" "product_class" DEFAULT 'default' NOT NULL,
	"product_type" "product_type" NOT NULL,
	"intended_use" text,
	"first_placed_on_market_date" date,
	"product_owner" text,
	"security_owner" text,
	"engineering_owner" text,
	"psirt_lead" text,
	"support_escalation_contacts" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "psirt_cases" (
	"case_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vulnerability_id" uuid,
	"intake_timestamp_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"intake_source" text NOT NULL,
	"reporter_category" text,
	"initial_summary" text NOT NULL,
	"product_match_result" text,
	"validity_decision" text,
	"reproducibility_status" text,
	"severity_assessment" "severity_level",
	"exposure_assessment" text,
	"exploitation_assessment" "exploitation_status",
	"regulatory_assessment" text,
	"customer_impact_assessment" text,
	"priority" text,
	"assigned_owner" text,
	"sla_clock_start" timestamp with time zone DEFAULT now() NOT NULL,
	"sla_deadlines" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"early_warning_sent_at" timestamp with time zone,
	"notification_sent_at" timestamp with time zone,
	"final_report_sent_at" timestamp with time zone,
	"next_action" text,
	"case_status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"token_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"role_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_name" text NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_role_name_unique" UNIQUE("role_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_ldap_accounts" (
	"ldap_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"dn" text NOT NULL,
	"username" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ldap_accounts_dn_unique" UNIQUE("dn"),
	CONSTRAINT "user_ldap_accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_oauth_accounts" (
	"oauth_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_role_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"organization" text,
	"department" text,
	"job_function" text,
	"manager_id" uuid,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"approval_authority" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vulnerability_cases" (
	"vulnerability_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"product_id" uuid NOT NULL,
	"affected_version_range" text NOT NULL,
	"affected_components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discovery_date_utc" timestamp with time zone NOT NULL,
	"discovery_source" text NOT NULL,
	"reporter_identity" text,
	"reporter_contact" text,
	"intake_channel" text NOT NULL,
	"initial_severity" "severity_level" NOT NULL,
	"current_severity" "severity_level" NOT NULL,
	"exploitation_status" "exploitation_status" DEFAULT 'unknown' NOT NULL,
	"exploit_evidence" text,
	"impact_summary" text,
	"exposure_scope" text,
	"affected_customers_estimate" integer,
	"triage_status" "triage_status" DEFAULT 'new' NOT NULL,
	"assigned_analyst" text,
	"assigned_engineer" text,
	"remediation_plan" text,
	"workaround_available" boolean DEFAULT false NOT NULL,
	"fix_version_id" uuid,
	"fix_release_date_utc" timestamp with time zone,
	"customer_advisory_date_utc" timestamp with time zone,
	"regulatory_report_required" boolean DEFAULT false NOT NULL,
	"regulatory_report_submitted_date_utc" timestamp with time zone,
	"closure_date_utc" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vulnerability_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vulnerability_id" uuid NOT NULL,
	"event_timestamp_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"actor" text,
	"action_taken" text,
	"decision_made" text,
	"evidence_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cra_reports" ADD CONSTRAINT "cra_reports_vulnerability_id_vulnerability_cases_vulnerability_id_fk" FOREIGN KEY ("vulnerability_id") REFERENCES "public"."vulnerability_cases"("vulnerability_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cra_reports" ADD CONSTRAINT "cra_reports_incident_id_incidents_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("incident_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cra_reports" ADD CONSTRAINT "cra_reports_psirt_case_id_psirt_cases_case_id_fk" FOREIGN KEY ("psirt_case_id") REFERENCES "public"."psirt_cases"("case_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cra_reports" ADD CONSTRAINT "cra_reports_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_related_vulnerability_id_vulnerability_cases_vulnerability_id_fk" FOREIGN KEY ("related_vulnerability_id") REFERENCES "public"."vulnerability_cases"("vulnerability_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_vulnerability_id_vulnerability_cases_vulnerability_id_fk" FOREIGN KEY ("vulnerability_id") REFERENCES "public"."vulnerability_cases"("vulnerability_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_incident_id_incidents_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("incident_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patches" ADD CONSTRAINT "patches_vulnerability_id_vulnerability_cases_vulnerability_id_fk" FOREIGN KEY ("vulnerability_id") REFERENCES "public"."vulnerability_cases"("vulnerability_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patches" ADD CONSTRAINT "patches_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patches" ADD CONSTRAINT "patches_version_id_product_versions_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."product_versions"("version_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patches" ADD CONSTRAINT "patches_fix_version_id_product_versions_version_id_fk" FOREIGN KEY ("fix_version_id") REFERENCES "public"."product_versions"("version_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_versions" ADD CONSTRAINT "product_versions_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_manufacturer_id_manufacturers_manufacturer_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("manufacturer_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "psirt_cases" ADD CONSTRAINT "psirt_cases_vulnerability_id_vulnerability_cases_vulnerability_id_fk" FOREIGN KEY ("vulnerability_id") REFERENCES "public"."vulnerability_cases"("vulnerability_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_ldap_accounts" ADD CONSTRAINT "user_ldap_accounts_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_oauth_accounts" ADD CONSTRAINT "user_oauth_accounts_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("role_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_users_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerability_cases" ADD CONSTRAINT "vulnerability_cases_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("product_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerability_cases" ADD CONSTRAINT "vulnerability_cases_fix_version_id_product_versions_version_id_fk" FOREIGN KEY ("fix_version_id") REFERENCES "public"."product_versions"("version_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vulnerability_events" ADD CONSTRAINT "vulnerability_events_vulnerability_id_vulnerability_cases_vulnerability_id_fk" FOREIGN KEY ("vulnerability_id") REFERENCES "public"."vulnerability_cases"("vulnerability_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_object" ON "audit_events" USING btree ("object_type","object_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cra_reports_vuln" ON "cra_reports" USING btree ("vulnerability_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cra_reports_incident" ON "cra_reports" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_incidents_related_vuln" ON "incidents" USING btree ("related_vulnerability_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_sent_at" ON "notifications" USING btree ("sent_at_utc");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_patches_vuln" ON "patches" USING btree ("vulnerability_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_versions_product" ON "product_versions" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "versions_product_version_uniq" ON "product_versions" USING btree ("product_id","version_string");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_products_manufacturer" ON "products" USING btree ("manufacturer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_mfg_name_model_uniq" ON "products" USING btree ("manufacturer_id","product_name","model_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_psirt_vuln" ON "psirt_cases" USING btree ("vulnerability_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_ldap_user" ON "user_ldap_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_oauth_accounts_provider_id_uniq" ON "user_oauth_accounts" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_oauth_user" ON "user_oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_role_uniq" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vuln_product" ON "vulnerability_cases" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vuln_discovery_date" ON "vulnerability_cases" USING btree ("discovery_date_utc");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vuln_events_vuln_time" ON "vulnerability_events" USING btree ("vulnerability_id","event_timestamp_utc");