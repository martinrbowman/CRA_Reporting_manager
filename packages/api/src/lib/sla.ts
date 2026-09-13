// CRA Art. 14 SLA windows, shared by routes/psirt.ts (per-case clock) and
// routes/cra-reports.ts (per-report deadline) — source duplicated these
// constants in both files, consolidated here during the fork.

export const DEADLINES_MS = {
  earlyWarning: 24 * 60 * 60 * 1000,       // 24h
  notification: 72 * 60 * 60 * 1000,        // 72h
  finalReport: 14 * 24 * 60 * 60 * 1000,    // 14 days
} as const;

export const SLA_WARNING_WINDOW_MS = 8 * 60 * 60 * 1000; // 8h pre-breach warning

export type SlaDeadlineKey = keyof typeof DEADLINES_MS;

export function computeSlaDeadlines(clockStart: Date): Record<SlaDeadlineKey, string> {
  return {
    earlyWarning: new Date(clockStart.getTime() + DEADLINES_MS.earlyWarning).toISOString(),
    notification: new Date(clockStart.getTime() + DEADLINES_MS.notification).toISOString(),
    finalReport: new Date(clockStart.getTime() + DEADLINES_MS.finalReport).toISOString(),
  };
}

export function slaStatus(deadlines: Record<string, string>, closed: boolean): 'closed' | 'breached' | 'warning' | 'on_track' {
  if (closed) return 'closed';
  const now = Date.now();
  let breached = false;
  let warning = false;
  for (const iso of Object.values(deadlines)) {
    const diff = new Date(iso).getTime() - now;
    if (diff < 0) breached = true;
    else if (diff < SLA_WARNING_WINDOW_MS) warning = true;
  }
  if (breached) return 'breached';
  if (warning) return 'warning';
  return 'on_track';
}

// cra_reports uses report-type keys instead of psirt_cases's camelCase keys —
// same three windows, different naming convention inherited from source.
export const REPORT_DEADLINES_MS = {
  early_warning: DEADLINES_MS.earlyWarning,
  full_notification: DEADLINES_MS.notification,
  final_report: DEADLINES_MS.finalReport,
} as const;

export type ReportDeadlineType = keyof typeof REPORT_DEADLINES_MS;

export function reportDeadline(type: ReportDeadlineType, from: Date): Date {
  return new Date(from.getTime() + REPORT_DEADLINES_MS[type]);
}
