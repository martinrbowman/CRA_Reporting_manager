import { clsx } from 'clsx';
import type { SeverityLevelType } from '@cra/shared';

interface Props { severity: SeverityLevelType; size?: 'sm' | 'md' }

const map: Record<SeverityLevelType, string> = {
  low: 'badge-severity-low',
  medium: 'badge-severity-medium',
  high: 'badge-severity-high',
  critical: 'badge-severity-critical',
};

export default function SeverityBadge({ severity, size = 'sm' }: Props) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded px-1.5 py-0.5 font-mono font-medium uppercase tracking-wider',
      size === 'sm' ? 'text-xs' : 'text-sm',
      map[severity],
    )}>
      {severity}
    </span>
  );
}
