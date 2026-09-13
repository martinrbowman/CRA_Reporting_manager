import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface Patch {
  patchId: string;
  vulnerabilityId: string;
  productId: string;
  patchType: string;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'superseded';
  releaseDateUtc?: string;
  distributionMethod?: string;
  rolloutStatus?: string;
  verificationStatus?: string;
  advisoryReference?: string;
  customerInstructions?: string;
  implementationReference?: string;
  testPlan?: string;
  testEvidence?: string;
  rolloutPlan?: string;
  rollbackPlan?: string;
  createdAt: string;
}

interface Vuln { vulnerabilityId: string; externalId?: string; affectedVersionRange: string; }
interface Product { productId: string; productName: string; }

const APPROVAL_BADGE: Record<string, string> = {
  pending:    'bg-yellow-900/40 text-yellow-300',
  approved:   'bg-green-900/40 text-green-300',
  rejected:   'bg-red-900/40 text-red-300',
  superseded: 'bg-gray-800 text-gray-400',
};

const PATCH_TYPES = [
  'security_fix', 'mitigation', 'workaround', 'configuration_change', 'hotfix', 'full_release',
];

export default function PatchesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Patch | null>(null);
  const [filterVulnId, setFilterVulnId] = useState('');
  const [form, setForm] = useState({
    vulnerabilityId: '',
    productId: '',
    patchType: 'security_fix',
    implementationReference: '',
    testPlan: '',
    distributionMethod: '',
    rollbackPlan: '',
    advisoryReference: '',
    customerInstructions: '',
  });

  const { data: patches, isLoading } = useQuery<Patch[]>({
    queryKey: ['patches', filterVulnId],
    queryFn: () => api.get(filterVulnId ? `/patches?vulnerabilityId=${filterVulnId}` : '/patches'),
  });

  const { data: vulns } = useQuery<Vuln[]>({
    queryKey: ['vulnerabilities'],
    queryFn: () => api.get('/vulnerabilities'),
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/products'),
  });

  const create = useMutation({
    mutationFn: () => api.post('/patches', {
      vulnerabilityId: form.vulnerabilityId,
      productId: form.productId,
      patchType: form.patchType,
      implementationReference: form.implementationReference || undefined,
      testPlan: form.testPlan || undefined,
      distributionMethod: form.distributionMethod || undefined,
      rollbackPlan: form.rollbackPlan || undefined,
      advisoryReference: form.advisoryReference || undefined,
      customerInstructions: form.customerInstructions || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patches'] });
      setShowForm(false);
      setForm((f) => ({ ...f, implementationReference: '', testPlan: '', advisoryReference: '', customerInstructions: '' }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch(`/patches/${id}`, patch),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['patches'] });
      setSelected(updated as Patch);
    },
  });

  // Routes through the maker-checker Approvals system (segregation of duties
  // enforced there — the requester can't also decide it) instead of flipping
  // approvalStatus directly, which would let whoever created the patch also
  // approve their own work.
  const requestApproval = useMutation({
    mutationFn: (id: string) => api.post('/approvals', { objectType: 'patch', objectId: id, approvalType: 'patch_release' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });

  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const canCreate = form.vulnerabilityId && form.productId && form.patchType;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Patches</h1>
          <p className="text-sm text-gray-500">Remediation tracking for vulnerability fixes</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
          + New patch
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          className="border border-gray-700 bg-gray-900 text-gray-300 rounded-md px-2 py-1.5 text-sm"
          value={filterVulnId}
          onChange={(e) => setFilterVulnId(e.target.value)}
        >
          <option value="">All vulnerabilities</option>
          {vulns?.map((v) => (
            <option key={v.vulnerabilityId} value={v.vulnerabilityId}>
              {v.externalId ?? v.vulnerabilityId.slice(0, 8)} — {v.affectedVersionRange}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-300">New patch</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Vulnerability *</label>
              <select className="w-full border border-gray-700 bg-gray-900 text-gray-300 rounded-md px-2 py-1.5 text-sm"
                value={form.vulnerabilityId} onChange={(e) => set({ vulnerabilityId: e.target.value })}>
                <option value="">Select…</option>
                {vulns?.map((v) => (
                  <option key={v.vulnerabilityId} value={v.vulnerabilityId}>
                    {v.externalId ?? v.vulnerabilityId.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Product *</label>
              <select className="w-full border border-gray-700 bg-gray-900 text-gray-300 rounded-md px-2 py-1.5 text-sm"
                value={form.productId} onChange={(e) => set({ productId: e.target.value })}>
                <option value="">Select…</option>
                {products?.map((p) => (
                  <option key={p.productId} value={p.productId}>{p.productName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Patch type *</label>
              <select className="w-full border border-gray-700 bg-gray-900 text-gray-300 rounded-md px-2 py-1.5 text-sm"
                value={form.patchType} onChange={(e) => set({ patchType: e.target.value })}>
                {PATCH_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Distribution method</label>
              <input className="w-full border border-gray-700 bg-gray-900 text-gray-300 rounded-md px-2 py-1.5 text-sm"
                value={form.distributionMethod} onChange={(e) => set({ distributionMethod: e.target.value })}
                placeholder="OTA / manual / package manager" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Implementation reference</label>
              <input className="w-full border border-gray-700 bg-gray-900 text-gray-300 rounded-md px-2 py-1.5 text-sm"
                value={form.implementationReference} onChange={(e) => set({ implementationReference: e.target.value })}
                placeholder="PR / commit / ticket" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Advisory reference</label>
              <input className="w-full border border-gray-700 bg-gray-900 text-gray-300 rounded-md px-2 py-1.5 text-sm"
                value={form.advisoryReference} onChange={(e) => set({ advisoryReference: e.target.value })}
                placeholder="CVE / advisory URL" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Test plan</label>
            <input className="w-full border border-gray-700 bg-gray-900 text-gray-300 rounded-md px-2 py-1.5 text-sm"
              value={form.testPlan} onChange={(e) => set({ testPlan: e.target.value })} />
          </div>
          {create.error && <p className="text-xs text-red-400">{(create.error as Error).message}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm border border-gray-700 rounded-md hover:bg-gray-800/50 text-gray-300">Cancel</button>
            <button onClick={() => create.mutate()}
              disabled={!canCreate || create.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
              {create.isPending ? 'Creating…' : 'Create patch'}
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mb-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">{selected.patchType.replace(/_/g, ' ')}</h2>
              <span className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${APPROVAL_BADGE[selected.approvalStatus]}`}>
                {selected.approvalStatus}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-200 text-sm">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {selected.distributionMethod && <div><p className="text-xs text-gray-500">Distribution</p><p className="text-gray-300">{selected.distributionMethod}</p></div>}
            {selected.rolloutStatus && <div><p className="text-xs text-gray-500">Rollout</p><p className="text-gray-300">{selected.rolloutStatus}</p></div>}
            {selected.verificationStatus && <div><p className="text-xs text-gray-500">Verification</p><p className="text-gray-300">{selected.verificationStatus}</p></div>}
            {selected.releaseDateUtc && <div><p className="text-xs text-gray-500">Released</p><p className="text-gray-300">{new Date(selected.releaseDateUtc).toLocaleDateString()}</p></div>}
          </div>
          {selected.implementationReference && (
            <div><p className="text-xs text-gray-500 mb-1">Implementation</p><p className="text-sm text-gray-300">{selected.implementationReference}</p></div>
          )}
          {selected.advisoryReference && (
            <div><p className="text-xs text-gray-500 mb-1">Advisory</p><p className="text-sm text-gray-300">{selected.advisoryReference}</p></div>
          )}
          {selected.customerInstructions && (
            <div><p className="text-xs text-gray-500 mb-1">Customer instructions</p><p className="text-sm text-gray-300">{selected.customerInstructions}</p></div>
          )}
          <div className="flex gap-3 pt-2 border-t border-gray-800 flex-wrap">
            {selected.approvalStatus === 'pending' && (
              <button onClick={() => requestApproval.mutate(selected.patchId)} disabled={requestApproval.isPending}
                className="text-xs text-blue-400 hover:underline disabled:opacity-40">
                {requestApproval.isPending ? 'Requesting…' : 'Request approval'}
              </button>
            )}
            {requestApproval.isSuccess && selected.approvalStatus === 'pending' && (
              <span className="text-xs text-gray-500">Requested — decide on the Approvals page.</span>
            )}
            {selected.approvalStatus === 'approved' && !selected.releaseDateUtc && (
              <button onClick={() => updateStatus.mutate({ id: selected.patchId, patch: { releaseDateUtc: new Date().toISOString(), rolloutStatus: 'released' } })}
                className="text-xs text-blue-400 hover:underline">Mark released</button>
            )}
            {selected.approvalStatus === 'approved' && selected.releaseDateUtc && !selected.verificationStatus && (
              <button onClick={() => updateStatus.mutate({ id: selected.patchId, patch: { verificationStatus: 'verified' } })}
                className="text-xs text-purple-400 hover:underline">Mark verified</button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : patches?.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No patches recorded.</div>
      ) : (
        <div className="space-y-2">
          {patches?.map((p) => (
            <button key={p.patchId} onClick={() => setSelected(p)}
              className={`w-full text-left bg-gray-900 border rounded-lg p-4 hover:border-gray-600 transition-colors ${selected?.patchId === p.patchId ? 'border-blue-500' : 'border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${APPROVAL_BADGE[p.approvalStatus]}`}>
                    {p.approvalStatus}
                  </span>
                  <span className="text-sm font-medium text-white">{p.patchType.replace(/_/g, ' ')}</span>
                  {p.advisoryReference && <span className="text-xs text-gray-500">{p.advisoryReference}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {p.verificationStatus && <span className="text-purple-400">{p.verificationStatus}</span>}
                  {p.releaseDateUtc && <span>Released {new Date(p.releaseDateUtc).toLocaleDateString()}</span>}
                  <span>Created {new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
