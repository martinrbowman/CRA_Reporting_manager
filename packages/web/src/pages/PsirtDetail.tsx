import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../lib/api.js';
import SeverityBadge from '../components/ui/SeverityBadge.js';
import type { SeverityLevelType } from '@cra/shared';

const DEADLINE_LABELS: Record<string, string> = {
  earlyWarning: '24h early warning',
  notification: '72h notification',
  finalReport:  '14d final report',
};

function formatRemaining(iso: string): { text: string; color: string } {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return { text: 'OVERDUE', color: 'text-red-400' };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const text = h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h remaining` : `${h}h ${m}m remaining`;
  const color = diff < 8 * 3600000 ? 'text-yellow-400' : 'text-green-400';
  return { text, color };
}

interface PsirtCase {
  caseId: string;
  vulnerabilityId: string | null;
  intakeTimestampUtc: string;
  intakeSource: string;
  reporterCategory: string | null;
  initialSummary: string;
  productMatchResult: string | null;
  validityDecision: string | null;
  reproducibilityStatus: string | null;
  severityAssessment: SeverityLevelType | null;
  exposureAssessment: string | null;
  exploitationAssessment: string | null;
  regulatoryAssessment: string | null;
  customerImpactAssessment: string | null;
  priority: string | null;
  assignedOwner: string | null;
  slaClockStart: string;
  slaDeadlines: Record<string, string>;
  earlyWarningSentAt: string | null;
  notificationSentAt: string | null;
  finalReportSentAt: string | null;
  nextAction: string | null;
  caseStatus: string;
  createdAt: string;
  updatedAt: string;
}

const VALIDITY = ['confirmed', 'unconfirmed', 'duplicate', 'wont_fix', 'out_of_scope'];
const SEVERITY_OPTIONS: SeverityLevelType[] = ['low', 'medium', 'high', 'critical'];
const EXPLOITATIONS = ['unknown', 'possible', 'confirmed', 'actively_exploited'];
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

export default function PsirtDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [patch, setPatch] = useState<Partial<PsirtCase>>({});

  const { data: psirtCase, isLoading, isError, error } = useQuery<PsirtCase>({
    queryKey: ['psirt-case', caseId],
    queryFn: () => api.get(`/psirt/cases/${caseId}`),
    enabled: !!caseId,
  });

  const update = useMutation({
    mutationFn: () => api.patch(`/psirt/cases/${caseId}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['psirt-case', caseId] });
      qc.invalidateQueries({ queryKey: ['psirt-cases'] });
      setEditMode(false);
      setPatch({});
    },
  });

  const requestClosure = useMutation({
    mutationFn: () => api.post('/approvals', {
      objectType: 'psirt_case',
      objectId: caseId,
      approvalType: 'case_closure',
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['psirt-case', caseId] }),
  });

  const resetSla = useMutation({
    mutationFn: () => api.post(`/psirt/cases/${caseId}/reset-sla`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['psirt-case', caseId] });
      qc.invalidateQueries({ queryKey: ['psirt-sla-summary'] });
    },
  });

  const art14Submit = useMutation({
    mutationFn: (type: 'earlyWarning' | 'notification' | 'finalReport') =>
      api.post(`/psirt/cases/${caseId}/art14-submit`, { type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['psirt-case', caseId] });
    },
  });

  const set = (p: Partial<PsirtCase>) => setPatch((f) => ({ ...f, ...p }));
  const val = <K extends keyof PsirtCase>(key: K): PsirtCase[K] =>
    (patch[key] !== undefined ? patch[key] : psirtCase?.[key]) as PsirtCase[K];

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (isError) return <div className="p-6 text-sm text-red-400">{(error as Error).message}</div>;
  if (!psirtCase) return <div className="p-6 text-sm text-red-400">Case not found</div>;

  const slaHours = Math.floor((Date.now() - new Date(psirtCase.slaClockStart).getTime()) / 3600000);
  const deadlines = psirtCase.slaDeadlines ?? {};
  const hasDeadlines = Object.keys(deadlines).length > 0;
  const isBreached = hasDeadlines && Object.values(deadlines).some((iso) => new Date(iso).getTime() < Date.now());

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => navigate('/psirt')} className="text-xs text-gray-400 hover:text-gray-200 mb-2 block">← PSIRT queue</button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white leading-snug">{psirtCase.initialSummary}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {psirtCase.intakeSource}
              {psirtCase.reporterCategory && ` · ${psirtCase.reporterCategory}`}
              {' · '}{format(new Date(psirtCase.intakeTimestampUtc), 'dd MMM yyyy HH:mm')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {psirtCase.caseStatus === 'open' && (
              <button
                onClick={() => requestClosure.mutate()}
                disabled={requestClosure.isPending}
                className="px-2.5 py-1 text-xs border border-gray-700 text-gray-400 rounded-md hover:text-red-400 hover:border-red-800 disabled:opacity-40">
                {requestClosure.isPending ? 'Requesting…' : 'Request closure'}
              </button>
            )}
            <button onClick={() => { setEditMode((m) => !m); setPatch({}); }}
              className="px-2.5 py-1 text-xs border border-gray-700 text-gray-400 rounded-md hover:text-white hover:border-gray-500">
              {editMode ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Status</p>
            <span className={`text-xs px-2 py-0.5 rounded capitalize ${psirtCase.caseStatus === 'open' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
              {psirtCase.caseStatus}
            </span>
          </div>
          {psirtCase.priority && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Priority</p>
              <p className="text-sm font-semibold text-white">{psirtCase.priority}</p>
            </div>
          )}
          {psirtCase.assignedOwner && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Owner</p>
              <p className="text-sm text-gray-300">{psirtCase.assignedOwner}</p>
            </div>
          )}
          {psirtCase.vulnerabilityId && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Vulnerability</p>
              <Link to={`/vulnerabilities/${psirtCase.vulnerabilityId}`}
                className="text-xs text-blue-400 hover:underline font-mono">
                {psirtCase.vulnerabilityId.slice(0, 8)}…
              </Link>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Clock elapsed</p>
            <p className="text-sm font-mono text-gray-300">{slaHours}h</p>
          </div>
        </div>
        {psirtCase.severityAssessment && <SeverityBadge severity={psirtCase.severityAssessment} />}
      </div>

      {/* CRA Art. 14 SLA deadlines */}
      <div className={`bg-gray-900 border rounded-lg p-4 space-y-3 ${isBreached ? 'border-red-800' : 'border-gray-800'}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            CRA Art. 14 SLA deadlines
          </h2>
          {psirtCase.caseStatus === 'open' && (
            <button
              onClick={() => resetSla.mutate()}
              disabled={resetSla.isPending}
              className="text-xs px-2.5 py-1 border border-gray-700 text-gray-400 rounded-md hover:text-yellow-400 hover:border-yellow-800 disabled:opacity-40 transition-colors">
              {resetSla.isPending ? 'Resetting…' : 'Reset SLA clock'}
            </button>
          )}
        </div>
        {hasDeadlines ? (
          <div className="divide-y divide-gray-800">
            {(
              [
                ['earlyWarning', psirtCase.earlyWarningSentAt],
                ['notification', psirtCase.notificationSentAt],
                ['finalReport',  psirtCase.finalReportSentAt],
              ] as [string, string | null][]
            ).map(([key, sentAt]) => {
              const iso = deadlines[key];
              const label = DEADLINE_LABELS[key];
              if (!iso || !label) return null;
              const { text, color } = formatRemaining(iso);
              const breachedDeadline = new Date(iso).getTime() < Date.now();
              return (
                <div key={key} className="py-2.5 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-300">{label}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      deadline: {new Date(iso).toLocaleString()}
                    </p>
                    {sentAt && (
                      <p className="text-xs text-green-500 mt-0.5">
                        Submitted {new Date(sentAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 space-y-1">
                    {!sentAt ? (
                      <>
                        <span className={`block text-xs font-semibold ${color}`}>{text}</span>
                        {breachedDeadline && (
                          <span className="block text-xs text-red-500">Art. 14 breach</span>
                        )}
                        {psirtCase.caseStatus === 'open' && (
                          <button
                            onClick={() => art14Submit.mutate(key as 'earlyWarning' | 'notification' | 'finalReport')}
                            disabled={art14Submit.isPending}
                            className="text-xs px-2 py-0.5 border border-gray-700 text-gray-400 rounded hover:text-green-400 hover:border-green-800 disabled:opacity-40 transition-colors">
                            Mark sent
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-green-900/40 text-green-400 rounded">Submitted</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No SLA deadlines — case predates automatic tracking.
            {psirtCase.caseStatus === 'open' && ' Use "Reset SLA clock" to start tracking.'}
          </p>
        )}
        <p className="text-xs text-gray-600">
          Clock started: {new Date(psirtCase.slaClockStart).toLocaleString()}
        </p>
      </div>

      {/* Assessment grid */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Technical assessment</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Severity</label>
            {editMode ? (
              <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={val('severityAssessment') ?? ''}
                onChange={(e) => set({ severityAssessment: (e.target.value || undefined) as SeverityLevelType | undefined })}>
                <option value="">— None —</option>
                {SEVERITY_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            ) : (
              <p className="text-sm text-gray-300 capitalize">{psirtCase.severityAssessment ?? '—'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Validity decision</label>
            {editMode ? (
              <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={val('validityDecision') ?? ''}
                onChange={(e) => set({ validityDecision: e.target.value || undefined })}>
                <option value="">— None —</option>
                {VALIDITY.map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
              </select>
            ) : (
              <p className="text-sm text-gray-300 capitalize">{psirtCase.validityDecision?.replace('_', ' ') ?? '—'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Exploitation status</label>
            {editMode ? (
              <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={val('exploitationAssessment') ?? ''}
                onChange={(e) => set({ exploitationAssessment: e.target.value || undefined })}>
                <option value="">— None —</option>
                {EXPLOITATIONS.map((e) => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
              </select>
            ) : (
              <p className="text-sm text-gray-300 capitalize">{psirtCase.exploitationAssessment?.replace('_', ' ') ?? '—'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Priority</label>
            {editMode ? (
              <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={val('priority') ?? ''}
                onChange={(e) => set({ priority: e.target.value || undefined })}>
                <option value="">— None —</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <p className="text-sm text-gray-300">{psirtCase.priority ?? '—'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Assigned owner</label>
            {editMode ? (
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={val('assignedOwner') ?? ''}
                onChange={(e) => set({ assignedOwner: e.target.value || undefined })} />
            ) : (
              <p className="text-sm text-gray-300">{psirtCase.assignedOwner ?? '—'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Reproducibility</label>
            {editMode ? (
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={val('reproducibilityStatus') ?? ''}
                onChange={(e) => set({ reproducibilityStatus: e.target.value || undefined })} />
            ) : (
              <p className="text-sm text-gray-300">{psirtCase.reproducibilityStatus ?? '—'}</p>
            )}
          </div>
        </div>

        {(['exposureAssessment', 'regulatoryAssessment', 'customerImpactAssessment', 'nextAction'] as const).map((field) => (
          <div key={field}>
            <label className="block text-xs text-gray-500 mb-1 capitalize">
              {field.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </label>
            {editMode ? (
              <textarea rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={(val(field) as string) ?? ''}
                onChange={(e) => set({ [field]: e.target.value || undefined })} />
            ) : (
              <p className="text-sm text-gray-300">{psirtCase[field] ?? '—'}</p>
            )}
          </div>
        ))}

        {editMode && (
          <div className="flex gap-2 pt-2 border-t border-gray-800">
            <button onClick={() => { setEditMode(false); setPatch({}); }}
              className="px-3 py-1.5 text-xs border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Cancel</button>
            <button onClick={() => update.mutate()}
              disabled={update.isPending}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>

      {psirtCase.productMatchResult && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Context</h2>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Product match</p>
            <p className="text-sm text-gray-300">{psirtCase.productMatchResult}</p>
          </div>
        </div>
      )}
    </div>
  );
}
