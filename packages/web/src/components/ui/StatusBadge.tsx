import { clsx } from 'clsx';

interface Props { status: string; size?: 'sm' | 'md' }

const map: Record<string, string> = {
  new: 'badge-status-new',
  acknowledged: 'bg-cyan-900 text-cyan-300 border border-cyan-700',
  triaged: 'badge-status-triaged',
  reproduced: 'bg-indigo-900 text-indigo-300 border border-indigo-700',
  validated: 'bg-violet-900 text-violet-300 border border-violet-700',
  mitigating: 'badge-status-mitigating',
  fixed: 'badge-status-fixed',
  closed: 'badge-status-closed',
  false_positive: 'bg-gray-800 text-gray-400 border border-gray-600',
  open: 'badge-status-new',
  on_hold: 'bg-gray-800 text-gray-400 border border-gray-600',
};

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const cls = map[status] ?? 'bg-gray-800 text-gray-400 border border-gray-600';
  return (
    <span className={clsx(
      'inline-flex items-center rounded px-1.5 py-0.5 font-medium capitalize',
      size === 'sm' ? 'text-xs' : 'text-sm',
      cls,
    )}>
      {status.replace('_', ' ')}
    </span>
  );
}
