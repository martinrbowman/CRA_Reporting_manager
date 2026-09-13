import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { format } from 'date-fns';
import SeverityBadge from '../components/ui/SeverityBadge.js';
import StatusBadge from '../components/ui/StatusBadge.js';
import type { SeverityLevelType } from '@cra/shared';

interface Vulnerability {
  vulnerabilityId: string;
  externalId: string | null;
  productId: string;
  affectedVersionRange: string;
  discoveryDateUtc: string;
  discoverySource: string;
  initialSeverity: SeverityLevelType;
  currentSeverity: SeverityLevelType;
  triageStatus: string;
  exploitationStatus: string;
  assignedAnalyst: string | null;
}

export default function VulnerabilitiesPage() {
  const { data: vulns, isLoading, error } = useQuery({
    queryKey: ['vulnerabilities'],
    queryFn: () => api.get<Vulnerability[]>('/vulnerabilities'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Vulnerabilities</h1>
          <p className="text-sm text-gray-500 mt-0.5">{vulns?.length ?? 0} cases</p>
        </div>
        <Link
          to="/vulnerabilities/new"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          New case
        </Link>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-400">{String(error)}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">ID / External</th>
              <th className="text-left px-4 py-3 font-medium">Severity</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Exploitation</th>
              <th className="text-left px-4 py-3 font-medium">Discovered</th>
              <th className="text-left px-4 py-3 font-medium">Analyst</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {vulns?.map((v) => (
              <tr key={v.vulnerabilityId} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    to={`/vulnerabilities/${v.vulnerabilityId}`}
                    className="text-white hover:text-blue-400 font-mono text-xs transition-colors"
                  >
                    {v.externalId ?? v.vulnerabilityId.slice(0, 8) + '…'}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">{v.affectedVersionRange}</p>
                </td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={v.currentSeverity} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={v.triageStatus} />
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${
                    v.exploitationStatus === 'actively_exploited'
                      ? 'text-red-400'
                      : v.exploitationStatus === 'confirmed'
                      ? 'text-orange-400'
                      : 'text-gray-500'
                  }`}>
                    {v.exploitationStatus.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {format(new Date(v.discoveryDateUtc), 'dd MMM yyyy')}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {v.assignedAnalyst ?? <span className="text-gray-400">Unassigned</span>}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/vulnerabilities/${v.vulnerabilityId}`}>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </td>
              </tr>
            ))}
            {vulns?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No vulnerability cases yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
