import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface Version {
  versionId: string;
  productId: string;
  versionString: string;
  buildNumber?: string;
  commitHash?: string;
  buildDateUtc?: string;
  releaseType: string;
  releaseStatus: string;
  releaseNotes?: string;
  isEol: boolean;
  createdAt: string;
}

const RELEASE_TYPES = ['major', 'minor', 'patch', 'security', 'hotfix'] as const;
const RELEASE_STATUSES = ['planned', 'building', 'signed', 'released', 'rolled_back', 'withdrawn'] as const;

const STATUS_COLOR: Record<string, string> = {
  planned:     'bg-gray-800 text-gray-400',
  building:    'bg-blue-900/50 text-blue-300',
  signed:      'bg-purple-900/50 text-purple-300',
  released:    'bg-green-900/50 text-green-300',
  rolled_back: 'bg-orange-900/50 text-orange-300',
  withdrawn:   'bg-red-900/50 text-red-300',
};

const TYPE_COLOR: Record<string, string> = {
  major:    'bg-red-900/50 text-red-300',
  minor:    'bg-blue-900/50 text-blue-300',
  patch:    'bg-gray-800 text-gray-400',
  security: 'bg-orange-900/50 text-orange-300',
  hotfix:   'bg-yellow-900/50 text-yellow-300',
};

const NEXT_STATUS: Record<string, string> = {
  planned: 'building', building: 'signed', signed: 'released',
};

export default function VersionsPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Version | null>(null);

  const [form, setForm] = useState({
    versionString: '',
    buildNumber: '',
    commitHash: '',
    buildDateUtc: '',
    releaseType: 'patch' as typeof RELEASE_TYPES[number],
    releaseStatus: 'planned' as typeof RELEASE_STATUSES[number],
    releaseNotes: '',
  });

  const { data: versions, isLoading } = useQuery<Version[]>({
    queryKey: ['versions', productId],
    queryFn: () => api.get(`/products/${productId}/versions`),
    enabled: !!productId,
  });

  const create = useMutation({
    mutationFn: () => api.post(`/products/${productId}/versions`, {
      versionString: form.versionString,
      buildNumber: form.buildNumber || undefined,
      commitHash: form.commitHash || undefined,
      buildDateUtc: form.buildDateUtc ? new Date(form.buildDateUtc).toISOString() : undefined,
      releaseType: form.releaseType,
      releaseStatus: form.releaseStatus,
      releaseNotes: form.releaseNotes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['versions', productId] });
      setShowForm(false);
      setForm((f) => ({ ...f, versionString: '', buildNumber: '', commitHash: '', releaseNotes: '' }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ versionId, releaseStatus }: { versionId: string; releaseStatus: string }) =>
      api.patch(`/versions/${versionId}`, { releaseStatus }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['versions', productId] });
      setSelected(updated as Version);
    },
  });

  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="text-xs text-gray-500 hover:text-gray-300 mb-1 block">← Back</button>
          <h1 className="text-lg font-semibold text-white">Product Versions</h1>
          <p className="text-sm text-gray-500 mt-0.5">{versions?.length ?? 0} version{versions?.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors">
          + Add version
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">New version</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Version string *</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.versionString} onChange={(e) => set({ versionString: e.target.value })}
                placeholder="e.g. 2.1.4" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Release type *</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.releaseType} onChange={(e) => set({ releaseType: e.target.value as typeof RELEASE_TYPES[number] })}>
                {RELEASE_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.releaseStatus} onChange={(e) => set({ releaseStatus: e.target.value as typeof RELEASE_STATUSES[number] })}>
                {RELEASE_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Build number</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.buildNumber} onChange={(e) => set({ buildNumber: e.target.value })} placeholder="e.g. 4821" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Commit hash</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm font-mono text-white"
                value={form.commitHash} onChange={(e) => set({ commitHash: e.target.value })} placeholder="abc1234" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Build date</label>
              <input type="datetime-local" className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.buildDateUtc} onChange={(e) => set({ buildDateUtc: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Release notes</label>
            <textarea rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.releaseNotes} onChange={(e) => set({ releaseNotes: e.target.value })} />
          </div>
          {create.error && <p className="text-xs text-red-400">{(create.error as Error).message}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Cancel</button>
            <button onClick={() => create.mutate()}
              disabled={!form.versionString || create.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
              {create.isPending ? 'Adding…' : 'Add version'}
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-white">{selected.versionString}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${TYPE_COLOR[selected.releaseType]}`}>{selected.releaseType}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLOR[selected.releaseStatus]}`}>{selected.releaseStatus.replace('_', ' ')}</span>
              {selected.isEol && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">EOL</span>}
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-300 text-sm">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {selected.buildNumber && <div><p className="text-xs text-gray-500">Build</p><p className="font-mono text-gray-300">{selected.buildNumber}</p></div>}
            {selected.commitHash && <div><p className="text-xs text-gray-500">Commit</p><p className="font-mono text-gray-300 truncate">{selected.commitHash}</p></div>}
            {selected.buildDateUtc && <div><p className="text-xs text-gray-500">Built</p><p className="text-gray-300">{new Date(selected.buildDateUtc).toLocaleDateString()}</p></div>}
          </div>
          {selected.releaseNotes && <div><p className="text-xs text-gray-500 mb-0.5">Release notes</p><p className="text-sm text-gray-300">{selected.releaseNotes}</p></div>}
          {NEXT_STATUS[selected.releaseStatus] && (
            <button
              onClick={() => updateStatus.mutate({ versionId: selected.versionId, releaseStatus: NEXT_STATUS[selected.releaseStatus]! })}
              className="text-xs text-blue-400 hover:underline capitalize">
              Advance to {NEXT_STATUS[selected.releaseStatus]?.replace('_', ' ')} →
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : versions?.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-12 text-center text-sm text-gray-400">
          No versions yet. Add the first one.
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Version</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Build</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {versions?.map((v) => (
                <tr key={v.versionId} onClick={() => setSelected(selected?.versionId === v.versionId ? null : v)}
                  className={`cursor-pointer hover:bg-gray-800/50 transition-colors ${selected?.versionId === v.versionId ? 'bg-gray-800/50' : ''}`}>
                  <td className="px-4 py-3 font-mono font-medium text-white">{v.versionString}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${TYPE_COLOR[v.releaseType]}`}>{v.releaseType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLOR[v.releaseStatus]}`}>{v.releaseStatus.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{v.buildNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {v.buildDateUtc ? new Date(v.buildDateUtc).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
