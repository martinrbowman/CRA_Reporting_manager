import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, FileText, Send, Plus, Download } from 'lucide-react';
import { api, downloadBlob } from '../lib/api.js';

type ReportType = 'early_warning' | 'full_notification' | 'final_report';
type ReportStatus = 'draft' | 'pending_approval' | 'submitted' | 'rejected';

interface CraReport {
  reportId: string;
  reportType: ReportType;
  status: ReportStatus;
  vulnerabilityId: string | null;
  incidentId: string | null;
  psirtCaseId: string | null;
  productId: string | null;
  regulator: string | null;
  referenceNumber: string | null;
  deadlineUtc: string | null;
  submittedBy: string | null;
  submittedAtUtc: string | null;
  approvedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  early_warning: 'Early Warning (24h)',
  full_notification: 'Full Notification (72h)',
  final_report: 'Final Report (14d)',
};

const REPORT_TYPE_ARTICLE: Record<ReportType, string> = {
  early_warning: 'Art. 14§1',
  full_notification: 'Art. 14§2',
  final_report: 'Art. 14§5',
};

const STATUS_STYLE: Record<ReportStatus, string> = {
  draft: 'bg-gray-800 text-gray-300',
  pending_approval: 'bg-yellow-900/50 text-yellow-300',
  submitted: 'bg-green-900/50 text-green-300',
  rejected: 'bg-red-900/50 text-red-300',
};

function deadlineStatus(isoUtc: string | null): { label: string; style: string } {
  if (!isoUtc) return { label: '—', style: 'text-gray-500' };
  const ms = new Date(isoUtc).getTime() - Date.now();
  if (ms < 0) return { label: 'OVERDUE', style: 'text-red-400 font-semibold' };
  const h = Math.floor(ms / 3_600_000);
  if (h < 8) return { label: `${h}h remaining`, style: 'text-yellow-400' };
  if (h < 24) return { label: `${h}h remaining`, style: 'text-orange-400' };
  const d = Math.floor(h / 24);
  return { label: `${d}d ${h % 24}h remaining`, style: 'text-gray-400' };
}

function ReportTypeBadge({ type }: { type: ReportType }) {
  const colors: Record<ReportType, string> = {
    early_warning: 'bg-blue-900/50 text-blue-300',
    full_notification: 'bg-purple-900/50 text-purple-300',
    final_report: 'bg-indigo-900/50 text-indigo-300',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[type]}`}>
      {REPORT_TYPE_LABEL[type]}
    </span>
  );
}

interface QueueStartFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

function QueueStartForm({ onClose, onSuccess }: QueueStartFormProps) {
  const [entityId, setEntityId] = useState('');
  const [regulator, setRegulator] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: { entityId: string; regulator?: string }) =>
      api.post(`/cra/report-queue/${data.entityId}/start`, { regulator: data.regulator || undefined }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-base font-semibold text-white mb-4">Start CRA Art. 14 Report Queue</h2>
        <p className="text-xs text-gray-400 mb-4">
          Creates draft reports for all three Art. 14 deadlines (24h / 72h / 14d) linked to a
          vulnerability or incident ID.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Vulnerability or Incident ID (UUID)</label>
            <input
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Regulator (optional)</label>
            <input
              type="text"
              value={regulator}
              onChange={(e) => setRegulator(e.target.value)}
              placeholder="e.g. ENISA, BSI, ANSSI"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate({ entityId, regulator })}
            disabled={!entityId || mutation.isPending}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors">
            {mutation.isPending ? 'Starting…' : 'Start queue'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SubmitFormProps {
  report: CraReport;
  onClose: () => void;
  onSuccess: () => void;
}

function SubmitForm({ report, onClose, onSuccess }: SubmitFormProps) {
  const [refNum, setRefNum] = useState(report.referenceNumber ?? '');
  const [regulator, setRegulator] = useState(report.regulator ?? '');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/cra/reports/${report.reportId}`, {
        status: 'submitted',
        referenceNumber: refNum || undefined,
        regulator: regulator || undefined,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-base font-semibold text-white mb-1">Submit Report</h2>
        <p className="text-xs text-gray-400 mb-4">
          {REPORT_TYPE_LABEL[report.reportType]} · {REPORT_TYPE_ARTICLE[report.reportType]}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Regulator</label>
            <input type="text" value={regulator} onChange={(e) => setRegulator(e.target.value)}
              placeholder="e.g. ENISA, BSI, ANSSI"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Regulator reference number (optional)</label>
            <input type="text" value={refNum} onChange={(e) => setRefNum(e.target.value)}
              placeholder="Receipt or ticket number from regulator"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            {mutation.isPending ? 'Submitting…' : 'Mark submitted'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportingPage() {
  const qc = useQueryClient();
  const [showQueueForm, setShowQueueForm] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<CraReport | null>(null);
  const [filterStatus, setFilterStatus] = useState<ReportStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<ReportType | 'all'>('all');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: reports, isLoading, error } = useQuery<CraReport[]>({
    queryKey: ['cra-reports'],
    queryFn: () => api.get('/cra/reports'),
    refetchInterval: 60_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['cra-reports'] });

  // Requests maker-checker approval before a report can be submitted (see
  // the 409 gate in routes/cra-reports.ts's PATCH handler, which checks the
  // approvals table directly). Decision happens on the Approvals page —
  // by a different user than whoever requests it.
  const requestApproval = useMutation({
    mutationFn: (reportId: string) => api.post('/approvals', {
      objectType: 'cra_report',
      objectId: reportId,
      approvalType: 'report_submission',
    }),
    onSuccess: refresh,
  });

  const filtered = reports?.filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterType !== 'all' && r.reportType !== filterType) return false;
    return true;
  }) ?? [];

  const overdueCount = reports?.filter((r) =>
    r.status !== 'submitted' && r.deadlineUtc && new Date(r.deadlineUtc).getTime() < Date.now(),
  ).length ?? 0;

  const pending = reports?.filter((r) => r.status === 'draft' || r.status === 'pending_approval').length ?? 0;

  async function exportPdf(report: CraReport) {
    setExportError(null);
    setExportingId(report.reportId);
    try {
      const blob = await api.getBlob(`/cra/reports/${report.reportId}/export.pdf`);
      downloadBlob(blob, `cra-report-${report.reportType}-${report.reportId}.pdf`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">CRA Reporting</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Art. 14 submissions · {pending} pending · {reports?.filter((r) => r.status === 'submitted').length ?? 0} submitted
          </p>
        </div>
        <button
          onClick={() => setShowQueueForm(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Start report queue
        </button>
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-300">
            {overdueCount} report{overdueCount !== 1 ? 's' : ''} past CRA Art. 14 deadline — submit immediately
          </p>
        </div>
      )}

      {exportError && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-300">
          PDF export failed: {exportError}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ReportStatus | 'all')}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending approval</option>
            <option value="submitted">Submitted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as ReportType | 'all')}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500">
            <option value="all">All types</option>
            <option value="early_warning">Early Warning</option>
            <option value="full_notification">Full Notification</option>
            <option value="final_report">Final Report</option>
          </select>
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-400">{String(error)}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Deadline</th>
              <th className="text-left px-4 py-3 font-medium">Regulator</th>
              <th className="text-left px-4 py-3 font-medium">Ref #</th>
              <th className="text-left px-4 py-3 font-medium">Submitted</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="w-40 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((r) => {
              const dl = deadlineStatus(r.deadlineUtc);
              const isOverdue = r.status !== 'submitted' && r.deadlineUtc
                && new Date(r.deadlineUtc).getTime() < Date.now();
              return (
                <tr key={r.reportId}
                  className={`hover:bg-gray-800/50 transition-colors ${isOverdue ? 'border-l-2 border-red-600' : ''}`}>
                  <td className="px-4 py-3">
                    <ReportTypeBadge type={r.reportType} />
                    <p className="text-xs text-gray-500 mt-0.5">{REPORT_TYPE_ARTICLE[r.reportType]}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLE[r.status]}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.deadlineUtc ? (
                      <div>
                        <p className="text-xs text-gray-400">{format(new Date(r.deadlineUtc), 'dd MMM yyyy HH:mm')}</p>
                        {r.status !== 'submitted' && (
                          <p className={`text-xs mt-0.5 ${dl.style}`}>{dl.label}</p>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.regulator ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{r.referenceNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.submittedAtUtc ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {format(new Date(r.submittedAtUtc), 'dd MMM yyyy')}
                      </span>
                    ) : (
                      <span className="text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Not yet
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {format(new Date(r.createdAt), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(r.status === 'draft' || r.status === 'rejected') && (
                        <button
                          onClick={() => requestApproval.mutate(r.reportId)}
                          disabled={requestApproval.isPending}
                          title={r.status === 'rejected' ? (r.rejectionReason ?? 'Rejected') : undefined}
                          className="flex items-center gap-1 text-xs bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 px-2 py-1 rounded transition-colors disabled:opacity-40">
                          {r.status === 'rejected' ? 'Re-request approval' : 'Request approval'}
                        </button>
                      )}
                      {r.status === 'pending_approval' && !r.approvedBy && (
                        <span className="flex items-center gap-1 text-xs text-yellow-400">
                          <Clock className="w-3 h-3" />
                          Awaiting approval
                        </span>
                      )}
                      {r.status === 'pending_approval' && r.approvedBy && (
                        <button
                          onClick={() => setSubmitTarget(r)}
                          className="flex items-center gap-1 text-xs bg-green-900/40 hover:bg-green-800/60 text-green-300 px-2 py-1 rounded transition-colors">
                          <Send className="w-3 h-3" />
                          Submit
                        </button>
                      )}
                      {r.status === 'submitted' && (
                        <span className="flex items-center gap-1 text-xs text-green-500">
                          <CheckCircle className="w-3 h-3" />
                          Done
                        </span>
                      )}
                      <button
                        onClick={() => exportPdf(r)}
                        disabled={exportingId === r.reportId}
                        title="Export PDF"
                        className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded transition-colors disabled:opacity-40">
                        <Download className="w-3 h-3" />
                        {exportingId === r.reportId ? '…' : 'PDF'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <FileText className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No CRA reports yet.</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Use "Start report queue" to create Art. 14 draft reports for a vulnerability or incident.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showQueueForm && (
        <QueueStartForm
          onClose={() => setShowQueueForm(false)}
          onSuccess={refresh}
        />
      )}

      {submitTarget && (
        <SubmitForm
          report={submitTarget}
          onClose={() => setSubmitTarget(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
