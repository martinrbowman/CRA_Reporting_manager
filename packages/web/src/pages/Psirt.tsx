import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import { format } from 'date-fns';
import SeverityBadge from '../components/ui/SeverityBadge.js';
import StatusBadge from '../components/ui/StatusBadge.js';
import type { SeverityLevelType } from '@cra/shared';

interface PsirtCase {
  caseId: string;
  vulnerabilityId: string | null;
  intakeTimestampUtc: string;
  intakeSource: string;
  initialSummary: string;
  severityAssessment: SeverityLevelType | null;
  assignedOwner: string | null;
  caseStatus: string;
  priority: string | null;
  nextAction: string | null;
  slaClockStart: string;
  slaDeadlines: Record<string, string>;
}

interface SlaSummary {
  caseId: string;
  initialSummary: string;
  priority: string | null;
  slaStatus: 'on_track' | 'warning' | 'breached' | 'closed';
  slaClockStart: string;
  deadlines: Record<string, string>;
  nextDeadlineKey: string | null;
  nextDeadlineIso: string | null;
  nextDeadlineMsRemaining: number | null;
  assignedOwner: string | null;
}

const SLA_STATUS_STYLE: Record<string, string> = {
  on_track: 'bg-green-900/50 text-green-300',
  warning:  'bg-yellow-900/50 text-yellow-300',
  breached: 'bg-red-900/50 text-red-300',
  closed:   'bg-gray-800 text-gray-400',
};

const DEADLINE_LABELS: Record<string, string> = {
  earlyWarning: '24h early warning (Art. 14§1)',
  notification: '72h notification (Art. 14§2)',
  finalReport:  '14d final report (Art. 14§5)',
};

function formatRemaining(ms: number): string {
  if (ms < 0) return 'overdue';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

function SlaStatusBadge({ deadlines, closed }: { deadlines: Record<string, string>; closed: boolean }) {
  if (closed) return <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">closed</span>;
  if (!deadlines || Object.keys(deadlines).length === 0) {
    return <span className="text-xs text-gray-500">no SLA</span>;
  }
  const now = Date.now();
  const WARNING = 8 * 3600000;
  let status: 'on_track' | 'warning' | 'breached' = 'on_track';
  for (const iso of Object.values(deadlines)) {
    const diff = new Date(iso).getTime() - now;
    if (diff < 0) { status = 'breached'; break; }
    if (diff < WARNING) status = 'warning';
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${SLA_STATUS_STYLE[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function PsirtPage() {
  const { data: cases, isLoading, error } = useQuery({
    queryKey: ['psirt-cases'],
    queryFn: () => api.get<PsirtCase[]>('/psirt/cases'),
    refetchInterval: 60_000,
  });

  const { data: slaSummary } = useQuery<SlaSummary[]>({
    queryKey: ['psirt-sla-summary'],
    queryFn: () => api.get('/psirt/sla-summary'),
    refetchInterval: 60_000,
  });

  const open = cases?.filter((c) => c.caseStatus === 'open') ?? [];
  const closed = cases?.filter((c) => c.caseStatus !== 'open') ?? [];

  const breached = slaSummary?.filter((s) => s.slaStatus === 'breached') ?? [];
  const warning  = slaSummary?.filter((s) => s.slaStatus === 'warning') ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">PSIRT Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">{open.length} open · {closed.length} closed</p>
        </div>
        <Link to="/psirt/new"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors">
          New case
        </Link>
      </div>

      {/* SLA alert panel */}
      {(breached.length > 0 || warning.length > 0) && (
        <div className="space-y-2">
          {breached.length > 0 && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">
                  {breached.length} CRA Art. 14 deadline{breached.length !== 1 ? 's' : ''} BREACHED
                </p>
                <div className="mt-1 space-y-0.5">
                  {breached.map((s) => (
                    <p key={s.caseId} className="text-xs text-red-400">
                      <Link to={`/psirt/${s.caseId}`} className="underline hover:text-red-300">
                        {s.initialSummary.slice(0, 60)}
                      </Link>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
          {warning.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-300">
                  {warning.length} case{warning.length !== 1 ? 's' : ''} approaching deadline (&lt;8h)
                </p>
                <div className="mt-1 space-y-0.5">
                  {warning.map((s) => (
                    <p key={s.caseId} className="text-xs text-yellow-400">
                      <Link to={`/psirt/${s.caseId}`} className="underline hover:text-yellow-300">
                        {s.initialSummary.slice(0, 60)}
                      </Link>
                      {s.nextDeadlineMsRemaining != null && (
                        <span className="ml-2 text-yellow-500">({formatRemaining(s.nextDeadlineMsRemaining)} to {DEADLINE_LABELS[s.nextDeadlineKey!] ?? s.nextDeadlineKey})</span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-400">{String(error)}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Case</th>
              <th className="text-left px-4 py-3 font-medium">Severity</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">SLA</th>
              <th className="text-left px-4 py-3 font-medium">Next deadline</th>
              <th className="text-left px-4 py-3 font-medium">Owner</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {cases?.map((c) => {
              const sla = slaSummary?.find((s) => s.caseId === c.caseId);
              return (
                <tr key={c.caseId} className={`hover:bg-gray-800/50 transition-colors ${sla?.slaStatus === 'breached' ? 'border-l-2 border-red-600' : sla?.slaStatus === 'warning' ? 'border-l-2 border-yellow-600' : ''}`}>
                  <td className="px-4 py-3">
                    <Link to={`/psirt/${c.caseId}`}
                      className="text-white hover:text-blue-400 font-medium transition-colors block">
                      {c.initialSummary.length > 55 ? c.initialSummary.slice(0, 55) + '…' : c.initialSummary}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.intakeSource} · {format(new Date(c.intakeTimestampUtc), 'dd MMM yyyy')}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {c.severityAssessment
                      ? <SeverityBadge severity={c.severityAssessment} />
                      : <span className="text-xs text-gray-400">Pending</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.caseStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <SlaStatusBadge deadlines={c.slaDeadlines ?? {}} closed={c.caseStatus !== 'open'} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {sla?.nextDeadlineKey && sla.nextDeadlineMsRemaining != null ? (
                      <span className={sla.slaStatus === 'breached' ? 'text-red-400' : sla.slaStatus === 'warning' ? 'text-yellow-400' : 'text-gray-400'}>
                        {formatRemaining(sla.nextDeadlineMsRemaining)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{c.assignedOwner ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link to={`/psirt/${c.caseId}`}>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {cases?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No PSIRT cases yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
