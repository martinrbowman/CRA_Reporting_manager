export const ProductClass = ['default', 'important1', 'important2', 'critical'] as const;
export const ProductType = ['hardware', 'software', 'firmware', 'mixed'] as const;
export const ReleaseType = ['major', 'minor', 'patch', 'security', 'hotfix'] as const;
export const ReleaseStatus = ['planned', 'building', 'signed', 'released', 'rolled_back', 'withdrawn'] as const;
export const TriageStatus = ['new', 'acknowledged', 'triaged', 'reproduced', 'false_positive', 'validated', 'mitigating', 'fixed', 'closed'] as const;
export const SeverityLevel = ['low', 'medium', 'high', 'critical'] as const;
export const ExploitationStatus = ['unknown', 'possible', 'confirmed', 'actively_exploited'] as const;
export const NotificationType = ['customer', 'regulator', 'internal', 'supplier'] as const;
export const NotificationDeliveryStatus = ['queued', 'sent', 'delivered', 'failed', 'superseded'] as const;
export const ApprovalStatus = ['pending', 'approved', 'rejected', 'superseded'] as const;
export const ApprovalObjectType = ['psirt_case', 'vulnerability_severity', 'cra_report', 'patch'] as const;
export const UserStatus = ['active', 'suspended', 'disabled', 'pending'] as const;
export const CraReportType = ['early_warning', 'full_notification', 'final_report'] as const;
export const CraReportStatus = ['draft', 'pending_approval', 'submitted', 'rejected'] as const;

export const VulnerabilityEventType = [
  'Received', 'Acknowledged', 'TriageStarted', 'TriageCompleted',
  'Reproduced', 'FalsePositive', 'AffectedVersionsIdentified',
  'ExploitationConfirmed', 'MitigationPlanned', 'PatchBuilt',
  'PatchTested', 'PatchReleased', 'CustomerNotified',
  'RegulatorNotified', 'Closed',
] as const;

export type ProductClassType = typeof ProductClass[number];
export type ProductTypeType = typeof ProductType[number];
export type ReleaseTypeType = typeof ReleaseType[number];
export type ReleaseStatusType = typeof ReleaseStatus[number];
export type TriageStatusType = typeof TriageStatus[number];
export type SeverityLevelType = typeof SeverityLevel[number];
export type ExploitationStatusType = typeof ExploitationStatus[number];
export type ApprovalStatusType = typeof ApprovalStatus[number];
export type ApprovalObjectTypeType = typeof ApprovalObjectType[number];
export type UserStatusType = typeof UserStatus[number];
export type VulnerabilityEventTypeType = typeof VulnerabilityEventType[number];
export type CraReportTypeType = typeof CraReportType[number];
export type CraReportStatusType = typeof CraReportStatus[number];
