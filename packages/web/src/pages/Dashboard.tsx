import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Bug, ShieldAlert, AlertTriangle, Wrench } from 'lucide-react';
import { api } from '../lib/api.js';
import CraTimelinePanel from '../components/CraTimelinePanel.js';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  to?: string;
}

function StatCard({ label, value, icon: Icon, color, to }: StatCardProps) {
  const inner = (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-start gap-4 hover:border-gray-700 transition-colors">
      <div className={`p-2 rounded-md ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : <div>{inner}</div>;
}

interface Incident { closureDateUtc: string | null; }
interface PsirtCase { caseStatus: string; }
interface Vuln { triageStatus: string; }
interface Patch { approvalStatus: string; }
interface SlaSummary {
  caseId: string;
  initialSummary: string;
  slaStatus: 'on_track' | 'warning' | 'breached' | 'closed';
  nextDeadlineKey: string | null;
  nextDeadlineMsRemaining: number | null;
}

const DEADLINE_LABELS: Record<string, string> = {
  earlyWarning: '24h early warning',
  notification: '72h notification',
  finalReport: '14d final report',
};

function formatRemaining(ms: number): string {
  if (ms < 0) return 'overdue';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function DashboardPage() {
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.get<unknown[]>('/products') });
  const { data: vulns } = useQuery({ queryKey: ['vulnerabilities'], queryFn: () => api.get<Vuln[]>('/vulnerabilities') });
  const { data: cases } = useQuery({ queryKey: ['psirt-cases'], queryFn: () => api.get<PsirtCase[]>('/psirt/cases') });
  const { data: incidents } = useQuery({ queryKey: ['incidents'], queryFn: () => api.get<Incident[]>('/incidents') });
  const { data: patches } = useQuery({ queryKey: ['patches'], queryFn: () => api.get<Patch[]>('/patches') });
  const { data: slaSummary } = useQuery<SlaSummary[]>({
    queryKey: ['psirt-sla-summary'],
    queryFn: () => api.get('/psirt/sla-summary'),
    refetchInterval: 60_000,
  });

  const openIncidents = incidents?.filter((i) => !i.closureDateUtc).length ?? '—';
  const openCases = cases?.filter((c) => c.caseStatus === 'open').length ?? '—';
  const openVulns = vulns?.filter((v) => v.triageStatus !== 'closed').length ?? '—';
  const totalPatches = patches?.length ?? '—';

  const breached = slaSummary?.filter((s) => s.slaStatus === 'breached') ?? [];
  const warning = slaSummary?.filter((s) => s.slaStatus === 'warning') ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">CRA compliance overview</p>
      </div>

      {/* SLA alert panel */}
      {(breached.length > 0 || warning.length > 0) && (
        <div className="space-y-2">
          {breached.length > 0 && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-red-300">
                  {breached.length} CRA Art. 14 deadline{breached.length !== 1 ? 's' : ''} BREACHED
                </p>
              </div>
              <div className="space-y-0.5 ml-6">
                {breached.map((s) => (
                  <p key={s.caseId} className="text-xs text-red-400">
                    <Link to={`/psirt/${s.caseId}`} className="underline hover:text-red-300">
                      {s.initialSummary.length > 70 ? s.initialSummary.slice(0, 70) + '…' : s.initialSummary}
                    </Link>
                    {s.nextDeadlineKey && (
                      <span className="ml-2 text-red-500">
                        · {DEADLINE_LABELS[s.nextDeadlineKey] ?? s.nextDeadlineKey} overdue
                      </span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}
          {warning.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-yellow-300">
                  {warning.length} case{warning.length !== 1 ? 's' : ''} approaching Art. 14 deadline (&lt;8h)
                </p>
              </div>
              <div className="space-y-0.5 ml-6">
                {warning.map((s) => (
                  <p key={s.caseId} className="text-xs text-yellow-400">
                    <Link to={`/psirt/${s.caseId}`} className="underline hover:text-yellow-300">
                      {s.initialSummary.length > 70 ? s.initialSummary.slice(0, 70) + '…' : s.initialSummary}
                    </Link>
                    {s.nextDeadlineKey && s.nextDeadlineMsRemaining != null && (
                      <span className="ml-2 text-yellow-500">
                        · {DEADLINE_LABELS[s.nextDeadlineKey] ?? s.nextDeadlineKey} in {formatRemaining(s.nextDeadlineMsRemaining)}
                      </span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CraTimelinePanel variant="compact" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Products" value={products?.length ?? '—'} icon={Package} color="bg-blue-900 text-blue-300" to="/products" />
        <StatCard label="Open Vulnerabilities" value={openVulns} icon={Bug} color="bg-orange-900 text-orange-300" to="/vulnerabilities" />
        <StatCard label="Open PSIRT Cases" value={openCases} icon={ShieldAlert} color="bg-purple-900 text-purple-300" to="/psirt" />
        <StatCard label="Open Incidents" value={openIncidents} icon={AlertTriangle} color="bg-red-900 text-red-300" to="/incidents" />
        <StatCard label="Patches" value={totalPatches} icon={Wrench} color="bg-yellow-900 text-yellow-300" to="/patches" />
      </div>
    </div>
  );
}
