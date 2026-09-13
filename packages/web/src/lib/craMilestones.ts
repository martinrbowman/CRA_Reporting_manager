// Regulation (EU) 2024/2847 (Cyber Resilience Act) — Art. 71 application
// timeline. Shared by the Dashboard's embedded panel and the standalone
// CRA Timeline page so the two never drift apart.
export interface CraMilestone {
  date: string; // YYYY-MM-DD
  title: string;
  article: string;
  description: string;
  critical?: boolean;
}

export const CRA_MILESTONES: CraMilestone[] = [
  {
    date: '2024-11-20',
    title: 'CRA published in Official Journal',
    article: 'Regulation (EU) 2024/2847',
    description: 'EU Cyber Resilience Act formally published. Sets mandatory cybersecurity requirements for products with digital elements placed on the EU market.',
  },
  {
    date: '2024-12-10',
    title: 'Entry into force',
    article: 'Art. 71(1)',
    description: 'CRA enters into force 20 days after OJ publication. Obligations not yet applicable — transition periods begin.',
  },
  {
    date: '2026-06-10',
    title: 'Chapter IV applies — Conformity assessment bodies',
    article: 'Art. 71(2)(a) · 18 months',
    description: 'Provisions governing notified bodies and conformity assessment infrastructure become applicable.',
  },
  {
    date: '2026-09-11',
    title: 'Art. 14 vulnerability reporting obligations apply',
    article: 'Art. 71(2)(b) · 21 months',
    description: 'Manufacturers must report actively exploited vulnerabilities and severe incidents to ENISA and national CSIRTs within 24h (early warning), 72h (notification), and 14 days (final report). PSIRT SLA tracking mandatory.',
    critical: true,
  },
  {
    date: '2027-12-11',
    title: 'Full CRA application — all obligations',
    article: 'Art. 71(3) · 36 months',
    description: 'All essential cybersecurity requirements (Annex I) and vulnerability handling obligations (Annex II) apply to all products with digital elements placed on the EU market.',
    critical: true,
  },
];

export function localDaysUntil(dateStr: string): number {
  const parts = dateStr.split('-').map(Number);
  const target = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - todayMid.getTime()) / 86_400_000);
}

export type MilestoneStatus = 'passed' | 'imminent' | 'upcoming';

export function milestoneStatus(dateStr: string): MilestoneStatus {
  const days = localDaysUntil(dateStr);
  if (days < 0) return 'passed';
  if (days <= 90) return 'imminent';
  return 'upcoming';
}

export function nextUpcomingMilestone(): CraMilestone | undefined {
  return [...CRA_MILESTONES]
    .filter((m) => localDaysUntil(m.date) > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
}
