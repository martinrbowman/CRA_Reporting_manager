import { Fragment, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import { hasPermission } from '../lib/auth.js';

interface Approval {
  approvalId: string;
  objectType: string;
  objectId: string;
  approvalType: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  decidedBy: string | null;
  decisionDateUtc: string | null;
  rationale: string | null;
  createdAt: string;
}

// Trimmed to this fork's ApprovalObjectType enum: psirt_case,
// vulnerability_severity, cra_report, patch. No conformity_assessment/tara —
// those modules don't exist here.
const OBJECT_LABELS: Record<string, string> = {
  psirt_case: 'PSIRT Case',
  vulnerability_severity: 'Vulnerability',
  cra_report: 'CRA Report',
  patch: 'Patch',
};

const OBJECT_LINKS: Record<string, (id: string) => string> = {
  psirt_case: (id) => `/psirt/${id}`,
  vulnerability_severity: (id) => `/vulnerabilities/${id}`,
};

const STATUS_STYLE: Record<string, string> = {
  pending:    'bg-yellow-900/40 text-yellow-300',
  approved:   'bg-green-900/40 text-green-400',
  rejected:   'bg-red-900/40 text-red-400',
  superseded: 'bg-gray-800 text-gray-500',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'approved') return <CheckCircle className="w-4 h-4 text-green-400" />;
  if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-400" />;
  return <Clock className="w-4 h-4 text-yellow-400" />;
}

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const canDecide = hasPermission('approvals:write');

  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [rationale, setRationale] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery<Approval[]>({
    queryKey: ['approvals', filter],
    queryFn: () => api.get(`/approvals${filter === 'pending' ? '?status=pending' : ''}`),
    refetchInterval: 30_000,
  });

  const decide = useMutation({
    mutationFn: ({ approvalId, decision }: { approvalId: string; decision: 'approved' | 'rejected' }) =>
      api.patch(`/approvals/${approvalId}`, { decision, rationale: rationale[approvalId] ?? '' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['psirt-cases'] });
      qc.invalidateQueries({ queryKey: ['vulnerabilities'] });
      qc.invalidateQueries({ queryKey: ['cra-reports'] });
      qc.invalidateQueries({ queryKey: ['patches'] });
    },
  });

  const pending = items?.filter((a) => a.status === 'pending') ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Approvals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pending.length} pending
          </p>
        </div>
        <div className="flex gap-1">
          {(['pending', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-md capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Object</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Requested by</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              {canDecide && <th className="text-left px-4 py-3 font-medium">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {items?.map((a) => {
              const linkFn = OBJECT_LINKS[a.objectType];
              const isExpanded = expandedId === a.approvalId;
              return (
                <Fragment key={a.approvalId}>
                  <tr className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={a.status} />
                        <div>
                          <span className="text-xs text-gray-500">{OBJECT_LABELS[a.objectType] ?? a.objectType}</span>
                          {linkFn ? (
                            <Link to={linkFn(a.objectId)} className="block text-xs text-blue-400 hover:underline font-mono">
                              {a.objectId.slice(0, 8)}…
                            </Link>
                          ) : (
                            <span className="block text-xs text-gray-500 font-mono">{a.objectId.slice(0, 8)}…</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300 capitalize">{a.approvalType.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-xs text-gray-300">{a.requestedBy}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      {format(new Date(a.createdAt), 'dd MMM yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${STATUS_STYLE[a.status]}`}>
                        {a.status}
                      </span>
                      {a.decidedBy && (
                        <p className="text-xs text-gray-500 mt-0.5">by {a.decidedBy}</p>
                      )}
                    </td>
                    {canDecide && (
                      <td className="px-4 py-3">
                        {a.status === 'pending' ? (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : a.approvalId)}
                            className="text-xs text-gray-400 hover:text-white">
                            {isExpanded ? 'Cancel' : 'Decide'}
                          </button>
                        ) : (
                          a.rationale && (
                            <button onClick={() => setExpandedId(isExpanded ? null : a.approvalId)}
                              className="text-xs text-gray-500 hover:text-gray-300">
                              {isExpanded ? 'Hide' : 'Notes'}
                            </button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-800/30">
                      <td colSpan={canDecide ? 6 : 5} className="px-4 py-3">
                        {a.status === 'pending' ? (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              placeholder="Rationale (optional)"
                              value={rationale[a.approvalId] ?? ''}
                              onChange={(e) => setRationale((r) => ({ ...r, [a.approvalId]: e.target.value }))}
                              className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white placeholder-gray-600 resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => decide.mutate({ approvalId: a.approvalId, decision: 'approved' })}
                                disabled={decide.isPending}
                                className="px-3 py-1.5 text-xs bg-green-700 text-white rounded-md hover:bg-green-600 disabled:opacity-40">
                                Approve
                              </button>
                              <button
                                onClick={() => decide.mutate({ approvalId: a.approvalId, decision: 'rejected' })}
                                disabled={decide.isPending}
                                className="px-3 py-1.5 text-xs bg-red-800 text-white rounded-md hover:bg-red-700 disabled:opacity-40">
                                Reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">{a.rationale}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!isLoading && items?.length === 0 && (
              <tr>
                <td colSpan={canDecide ? 6 : 5} className="px-4 py-8 text-center text-sm text-gray-400">
                  No {filter === 'pending' ? 'pending ' : ''}approvals.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
