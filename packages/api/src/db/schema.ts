import {
  pgTable, pgEnum, uuid, text, boolean, integer,
  timestamp, date, jsonb, uniqueIndex, index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const emptyArray = sql`'{}'`;

// ── Enums ─────────────────────────────────────────────────────────────────────

export const productClassEnum = pgEnum('product_class', ['default', 'important1', 'important2', 'critical']);
export const productTypeEnum = pgEnum('product_type', ['hardware', 'software', 'firmware', 'mixed']);
export const releaseTypeEnum = pgEnum('release_type', ['major', 'minor', 'patch', 'security', 'hotfix']);
export const releaseStatusEnum = pgEnum('release_status', ['planned', 'building', 'signed', 'released', 'rolled_back', 'withdrawn']);
export const triageStatusEnum = pgEnum('triage_status', ['new', 'acknowledged', 'triaged', 'reproduced', 'false_positive', 'validated', 'mitigating', 'fixed', 'closed']);
export const severityLevelEnum = pgEnum('severity_level', ['low', 'medium', 'high', 'critical']);
export const exploitationStatusEnum = pgEnum('exploitation_status', ['unknown', 'possible', 'confirmed', 'actively_exploited']);
export const notificationTypeEnum = pgEnum('notification_type', ['customer', 'regulator', 'internal', 'supplier']);
export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', ['queued', 'sent', 'delivered', 'failed', 'superseded']);
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'rejected', 'superseded']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'disabled', 'pending']);
export const craReportTypeEnum = pgEnum('cra_report_type', ['early_warning', 'full_notification', 'final_report']);
export const craReportStatusEnum = pgEnum('cra_report_status', ['draft', 'pending_approval', 'submitted', 'rejected']);

// ── Users and roles ───────────────────────────────────────────────────────────

export const roles = pgTable('roles', {
  roleId: uuid('role_id').primaryKey().defaultRandom(),
  roleName: text('role_name').notNull().unique(),
  description: text('description'),
  permissions: jsonb('permissions').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  organization: text('organization'),
  department: text('department'),
  jobFunction: text('job_function'),
  managerId: uuid('manager_id').references((): AnyPgColumn => users.userId, { onDelete: 'set null' }),
  status: userStatusEnum('status').notNull().default('active'),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  approvalAuthority: jsonb('approval_authority').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userRoles = pgTable('user_roles', {
  userRoleId: uuid('user_role_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.roleId, { onDelete: 'cascade' }),
  assignedBy: text('assigned_by'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (t) => ({
  uniq: uniqueIndex('user_roles_user_role_uniq').on(t.userId, t.roleId),
}));

export const refreshTokens = pgTable('refresh_tokens', {
  tokenId: uuid('token_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const userOauthAccounts = pgTable('user_oauth_accounts', {
  oauthAccountId: uuid('oauth_account_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerId: text('provider_id').notNull(),
  providerEmail: text('provider_email'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex('user_oauth_accounts_provider_id_uniq').on(t.provider, t.providerId),
  userIdx: index('idx_user_oauth_user').on(t.userId),
}));

// New: LDAP/AD-linked accounts, mirrors user_oauth_accounts. LDAP server
// config itself lives in config/ldap.yml (file-based, ops-managed), not here —
// this table only records which local user a given directory entry resolves to.
export const userLdapAccounts = pgTable('user_ldap_accounts', {
  ldapAccountId: uuid('ldap_account_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  dn: text('dn').notNull().unique(),
  username: text('username').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('idx_user_ldap_user').on(t.userId),
}));

// ── Manufacturers ─────────────────────────────────────────────────────────────

export const manufacturers = pgTable('manufacturers', {
  manufacturerId: uuid('manufacturer_id').primaryKey().defaultRandom(),
  legalName: text('legal_name').notNull(),
  displayName: text('display_name'),
  euEstablishmentCountry: text('eu_establishment_country'),
  mainEstablishmentAddress: text('main_establishment_address'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  responsiblePersonEu: text('responsible_person_eu'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Products (trimmed — FK anchor for cases/reports, not a full CRA registry) ──

export const products = pgTable('products', {
  productId: uuid('product_id').primaryKey().defaultRandom(),
  manufacturerId: uuid('manufacturer_id').notNull().references(() => manufacturers.manufacturerId, { onDelete: 'restrict' }),
  productName: text('product_name').notNull(),
  modelNumber: text('model_number'),
  sku: text('sku'),
  productClass: productClassEnum('product_class').notNull().default('default'),
  productType: productTypeEnum('product_type').notNull(),
  intendedUse: text('intended_use'),
  firstPlacedOnMarketDate: date('first_placed_on_market_date'),
  productOwner: text('product_owner'),
  securityOwner: text('security_owner'),
  engineeringOwner: text('engineering_owner'),
  psirtLead: text('psirt_lead'),
  supportEscalationContacts: text('support_escalation_contacts').array().notNull().default(emptyArray),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  mfgIdx: index('idx_products_manufacturer').on(t.manufacturerId),
  uniq: uniqueIndex('products_mfg_name_model_uniq').on(t.manufacturerId, t.productName, t.modelNumber),
}));

// ── Product versions (trimmed — no build-signing/hardware-targeting fields) ────

export const productVersions = pgTable('product_versions', {
  versionId: uuid('version_id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.productId, { onDelete: 'cascade' }),
  versionString: text('version_string').notNull(),
  buildNumber: text('build_number'),
  commitHash: text('commit_hash'),
  buildDateUtc: timestamp('build_date_utc', { withTimezone: true }),
  releaseType: releaseTypeEnum('release_type').notNull(),
  releaseStatus: releaseStatusEnum('release_status').notNull().default('planned'),
  releaseNotes: text('release_notes'),
  isEol: boolean('is_eol').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  productIdx: index('idx_versions_product').on(t.productId),
  uniq: uniqueIndex('versions_product_version_uniq').on(t.productId, t.versionString),
}));

// ── Vulnerability cases ───────────────────────────────────────────────────────

export const vulnerabilityCases = pgTable('vulnerability_cases', {
  vulnerabilityId: uuid('vulnerability_id').primaryKey().defaultRandom(),
  externalId: text('external_id'),
  productId: uuid('product_id').notNull().references(() => products.productId, { onDelete: 'cascade' }),
  affectedVersionRange: text('affected_version_range').notNull(),
  affectedComponents: jsonb('affected_components').notNull().default([]),
  discoveryDateUtc: timestamp('discovery_date_utc', { withTimezone: true }).notNull(),
  discoverySource: text('discovery_source').notNull(),
  reporterIdentity: text('reporter_identity'),
  reporterContact: text('reporter_contact'),
  intakeChannel: text('intake_channel').notNull(),
  initialSeverity: severityLevelEnum('initial_severity').notNull(),
  currentSeverity: severityLevelEnum('current_severity').notNull(),
  exploitationStatus: exploitationStatusEnum('exploitation_status').notNull().default('unknown'),
  exploitEvidence: text('exploit_evidence'),
  impactSummary: text('impact_summary'),
  exposureScope: text('exposure_scope'),
  affectedCustomersEstimate: integer('affected_customers_estimate'),
  triageStatus: triageStatusEnum('triage_status').notNull().default('new'),
  assignedAnalyst: text('assigned_analyst'),
  assignedEngineer: text('assigned_engineer'),
  remediationPlan: text('remediation_plan'),
  workaroundAvailable: boolean('workaround_available').notNull().default(false),
  fixVersionId: uuid('fix_version_id').references(() => productVersions.versionId, { onDelete: 'set null' }),
  fixReleaseDateUtc: timestamp('fix_release_date_utc', { withTimezone: true }),
  customerAdvisoryDateUtc: timestamp('customer_advisory_date_utc', { withTimezone: true }),
  regulatoryReportRequired: boolean('regulatory_report_required').notNull().default(false),
  regulatoryReportSubmittedDateUtc: timestamp('regulatory_report_submitted_date_utc', { withTimezone: true }),
  closureDateUtc: timestamp('closure_date_utc', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  productIdx: index('idx_vuln_product').on(t.productId),
  discoveryIdx: index('idx_vuln_discovery_date').on(t.discoveryDateUtc),
}));

// ── Vulnerability events ──────────────────────────────────────────────────────

export const vulnerabilityEvents = pgTable('vulnerability_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  vulnerabilityId: uuid('vulnerability_id').notNull().references(() => vulnerabilityCases.vulnerabilityId, { onDelete: 'cascade' }),
  eventTimestampUtc: timestamp('event_timestamp_utc', { withTimezone: true }).notNull().defaultNow(),
  eventType: text('event_type').notNull(),
  actor: text('actor'),
  actionTaken: text('action_taken'),
  decisionMade: text('decision_made'),
  evidenceReference: text('evidence_reference'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  vulnTimeIdx: index('idx_vuln_events_vuln_time').on(t.vulnerabilityId, t.eventTimestampUtc),
}));

// ── PSIRT cases ───────────────────────────────────────────────────────────────

export const psirtCases = pgTable('psirt_cases', {
  caseId: uuid('case_id').primaryKey().defaultRandom(),
  vulnerabilityId: uuid('vulnerability_id').references(() => vulnerabilityCases.vulnerabilityId, { onDelete: 'set null' }),
  intakeTimestampUtc: timestamp('intake_timestamp_utc', { withTimezone: true }).notNull().defaultNow(),
  intakeSource: text('intake_source').notNull(),
  reporterCategory: text('reporter_category'),
  initialSummary: text('initial_summary').notNull(),
  productMatchResult: text('product_match_result'),
  validityDecision: text('validity_decision'),
  reproducibilityStatus: text('reproducibility_status'),
  severityAssessment: severityLevelEnum('severity_assessment'),
  exposureAssessment: text('exposure_assessment'),
  exploitationAssessment: exploitationStatusEnum('exploitation_assessment'),
  regulatoryAssessment: text('regulatory_assessment'),
  customerImpactAssessment: text('customer_impact_assessment'),
  priority: text('priority'),
  assignedOwner: text('assigned_owner'),
  slaClockStart: timestamp('sla_clock_start', { withTimezone: true }).notNull().defaultNow(),
  slaDeadlines: jsonb('sla_deadlines').notNull().default({}),
  earlyWarningSentAt: timestamp('early_warning_sent_at', { withTimezone: true }),
  notificationSentAt: timestamp('notification_sent_at', { withTimezone: true }),
  finalReportSentAt: timestamp('final_report_sent_at', { withTimezone: true }),
  nextAction: text('next_action'),
  caseStatus: text('case_status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  vulnIdx: index('idx_psirt_vuln').on(t.vulnerabilityId),
}));

// ── Patches ───────────────────────────────────────────────────────────────────

export const patches = pgTable('patches', {
  patchId: uuid('patch_id').primaryKey().defaultRandom(),
  vulnerabilityId: uuid('vulnerability_id').notNull().references(() => vulnerabilityCases.vulnerabilityId, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.productId, { onDelete: 'cascade' }),
  versionId: uuid('version_id').references(() => productVersions.versionId, { onDelete: 'set null' }),
  fixVersionId: uuid('fix_version_id').references(() => productVersions.versionId, { onDelete: 'set null' }),
  patchType: text('patch_type').notNull(),
  implementationReference: text('implementation_reference'),
  testPlan: text('test_plan'),
  testEvidence: text('test_evidence'),
  approvalStatus: approvalStatusEnum('approval_status').notNull().default('pending'),
  releaseDateUtc: timestamp('release_date_utc', { withTimezone: true }),
  distributionMethod: text('distribution_method'),
  rolloutPlan: text('rollout_plan'),
  rolloutStatus: text('rollout_status'),
  rollbackPlan: text('rollback_plan'),
  advisoryReference: text('advisory_reference'),
  customerInstructions: text('customer_instructions'),
  verificationStatus: text('verification_status'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  vulnIdx: index('idx_patches_vuln').on(t.vulnerabilityId),
}));

// ── Incidents ─────────────────────────────────────────────────────────────────

export const incidents = pgTable('incidents', {
  incidentId: uuid('incident_id').primaryKey().defaultRandom(),
  relatedVulnerabilityId: uuid('related_vulnerability_id').references(() => vulnerabilityCases.vulnerabilityId, { onDelete: 'set null' }),
  affectedProductIds: jsonb('affected_product_ids').notNull().default([]),
  detectionDateUtc: timestamp('detection_date_utc', { withTimezone: true }).notNull(),
  confirmationDateUtc: timestamp('confirmation_date_utc', { withTimezone: true }),
  incidentCategory: text('incident_category').notNull(),
  severity: severityLevelEnum('severity').notNull(),
  exploitationMethod: text('exploitation_method'),
  impactedSystems: jsonb('impacted_systems').notNull().default([]),
  containmentActions: text('containment_actions'),
  eradicationActions: text('eradication_actions'),
  recoveryActions: text('recovery_actions'),
  forensicEvidence: text('forensic_evidence'),
  rootCause: text('root_cause'),
  lessonsLearned: text('lessons_learned'),
  regulatorNotified: boolean('regulator_notified').notNull().default(false),
  customerNotified: boolean('customer_notified').notNull().default(false),
  closureDateUtc: timestamp('closure_date_utc', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  vulnIdx: index('idx_incidents_related_vuln').on(t.relatedVulnerabilityId),
}));

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  notificationId: uuid('notification_id').primaryKey().defaultRandom(),
  vulnerabilityId: uuid('vulnerability_id').references(() => vulnerabilityCases.vulnerabilityId, { onDelete: 'set null' }),
  incidentId: uuid('incident_id').references(() => incidents.incidentId, { onDelete: 'set null' }),
  notificationType: notificationTypeEnum('notification_type').notNull(),
  recipientType: text('recipient_type').notNull(),
  recipient: text('recipient'),
  sentAtUtc: timestamp('sent_at_utc', { withTimezone: true }).notNull(),
  channel: text('channel'),
  subject: text('subject'),
  body: text('body'),
  deliveryStatus: notificationDeliveryStatusEnum('delivery_status').notNull().default('queued'),
  deliveryReceipt: text('delivery_receipt'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  sentAtIdx: index('idx_notifications_sent_at').on(t.sentAtUtc),
}));

// ── Approvals (trimmed object types — no conformity/tara/risk_acceptance) ──────

export const approvals = pgTable('approvals', {
  approvalId: uuid('approval_id').primaryKey().defaultRandom(),
  objectType: text('object_type').notNull(),
  objectId: uuid('object_id').notNull(),
  approvalType: text('approval_type').notNull(),
  requestedBy: text('requested_by').notNull(),
  status: approvalStatusEnum('status').notNull().default('pending'),
  decidedBy: text('decided_by'),
  decisionDateUtc: timestamp('decision_date_utc', { withTimezone: true }),
  rationale: text('rationale'),
  evidenceReference: text('evidence_reference'),
  delegated: boolean('delegated').notNull().default(false),
  delegatedFrom: text('delegated_from'),
  expiryDate: timestamp('expiry_date', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── CRA Reports (Art. 14 formal submissions) ──────────────────────────────────

export const craReports = pgTable('cra_reports', {
  reportId: uuid('report_id').primaryKey().defaultRandom(),
  reportType: craReportTypeEnum('report_type').notNull(),
  status: craReportStatusEnum('status').notNull().default('draft'),
  vulnerabilityId: uuid('vulnerability_id').references(() => vulnerabilityCases.vulnerabilityId, { onDelete: 'set null' }),
  incidentId: uuid('incident_id').references(() => incidents.incidentId, { onDelete: 'set null' }),
  psirtCaseId: uuid('psirt_case_id').references(() => psirtCases.caseId, { onDelete: 'set null' }),
  productId: uuid('product_id').references(() => products.productId, { onDelete: 'set null' }),
  regulator: text('regulator'),
  referenceNumber: text('reference_number'),
  deadlineUtc: timestamp('deadline_utc', { withTimezone: true }),
  content: jsonb('content').notNull().default({}),
  submittedBy: text('submitted_by'),
  approvedBy: text('approved_by'),
  submittedAtUtc: timestamp('submitted_at_utc', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  vulnIdx: index('idx_cra_reports_vuln').on(t.vulnerabilityId),
  incidentIdx: index('idx_cra_reports_incident').on(t.incidentId),
}));

// ── Platform settings (SMTP config; OAuth/LDAP kept out — see routes/settings) ──

export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by'),
});

// ── Audit events ──────────────────────────────────────────────────────────────

export const auditEvents = pgTable('audit_events', {
  auditEventId: uuid('audit_event_id').primaryKey().defaultRandom(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  objectType: text('object_type').notNull(),
  // text, not uuid: several call sites (settings.ts, admin.ts) use fixed
  // string keys like 'smtp'/'oauth'/'ldap'/'system' as the objectId for
  // singleton/system-level audit entries, not just record UUIDs.
  objectId: text('object_id').notNull(),
  eventTimestampUtc: timestamp('event_timestamp_utc', { withTimezone: true }).notNull().defaultNow(),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
}, (t) => ({
  objectIdx: index('idx_audit_object').on(t.objectType, t.objectId),
}));
