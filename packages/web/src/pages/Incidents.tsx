import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface Incident {
  incidentId: string;
  incidentCategory: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectionDateUtc: string;
  confirmationDateUtc?: string;
  closureDateUtc?: string;
  regulatorNotified: boolean;
  customerNotified: boolean;
  impactedSystems: string[];
  containmentActions?: string;
  rootCause?: string;
  createdAt: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-green-900/40 text-green-300',
  medium: 'bg-yellow-900/40 text-yellow-300',
  high: 'bg-orange-900/40 text-orange-300',
  critical: 'bg-red-900/40 text-red-300',
};

const CATEGORIES = [
  'Ransomware', 'Data breach', 'Supply chain attack', 'Insider threat',
  'Denial of service', 'Vulnerability exploitation', 'Physical intrusion',
  'Credential compromise', 'Firmware tamper', 'Other',
];

export default function IncidentsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [form, setForm] = useState({
    incidentCategory: '',
    severity: 'high' as Incident['severity'],
    detectionDateUtc: new Date().toISOString().slice(0, 16),
    impactedSystems: '',
    exploitationMethod: '',
    containmentActions: '',
  });

  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: ['incidents'],
    queryFn: () => api.get('/incidents'),
  });

  const create = useMutation({
    mutationFn: () => api.post('/incidents', {
      incidentCategory: form.incidentCategory,
      severity: form.severity,
      detectionDateUtc: new Date(form.detectionDateUtc).toISOString(),
      impactedSystems: form.impactedSystems.split(',').map((s) => s.trim()).filter(Boolean),
      exploitationMethod: form.exploitationMethod || undefined,
      containmentActions: form.containmentActions || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      setShowForm(false);
    },
  });

  const updateField = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch(`/incidents/${id}`, patch),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      if (selected) setSelected(updated as Incident);
    },
  });

  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Incidents</h1>
          <p className="text-sm text-gray-500">Security incidents and response tracking</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
          + New incident
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-300">New incident</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Category *</label>
              <select className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.incidentCategory} onChange={(e) => set({ incidentCategory: e.target.value })}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Severity *</label>
              <select className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.severity} onChange={(e) => set({ severity: e.target.value as Incident['severity'] })}>
                {['low', 'medium', 'high', 'critical'].map((s) => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Detection date/time *</label>
              <input type="datetime-local" className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.detectionDateUtc} onChange={(e) => set({ detectionDateUtc: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Impacted systems</label>
              <input className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.impactedSystems} onChange={(e) => set({ impactedSystems: e.target.value })}
                placeholder="Comma-separated: API gateway, Auth service" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Exploitation method</label>
              <input className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.exploitationMethod} onChange={(e) => set({ exploitationMethod: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Initial containment</label>
              <input className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.containmentActions} onChange={(e) => set({ containmentActions: e.target.value })} />
            </div>
          </div>
          {create.error && <p className="text-xs text-red-400">{(create.error as Error).message}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm border border-gray-700 rounded-md hover:bg-gray-800/50">Cancel</button>
            <button onClick={() => create.mutate()}
              disabled={!form.incidentCategory || create.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
              {create.isPending ? 'Creating…' : 'Create incident'}
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mb-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">{selected.incidentCategory}</h2>
              <span className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${SEVERITY_BADGE[selected.severity]}`}>
                {selected.severity}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-200 text-sm">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-xs text-gray-500">Detected</p><p className="text-gray-300">{new Date(selected.detectionDateUtc).toLocaleString()}</p></div>
            {selected.confirmationDateUtc && <div><p className="text-xs text-gray-500">Confirmed</p><p className="text-gray-300">{new Date(selected.confirmationDateUtc).toLocaleString()}</p></div>}
            {selected.closureDateUtc && <div><p className="text-xs text-gray-500">Closed</p><p className="text-gray-300">{new Date(selected.closureDateUtc).toLocaleString()}</p></div>}
          </div>
          {selected.impactedSystems?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Impacted systems</p>
              <div className="flex flex-wrap gap-1">
                {selected.impactedSystems.map((s) => (
                  <span key={s} className="text-xs bg-red-900/40 text-red-300 px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}
          {selected.containmentActions && <div><p className="text-xs text-gray-500 mb-1">Containment</p><p className="text-sm text-gray-300">{selected.containmentActions}</p></div>}
          {selected.rootCause && <div><p className="text-xs text-gray-500 mb-1">Root cause</p><p className="text-sm text-gray-300">{selected.rootCause}</p></div>}
          <div className="flex gap-3 pt-2 border-t border-gray-800 items-center flex-wrap">
            {!selected.regulatorNotified && (
              <button onClick={() => updateField.mutate({ id: selected.incidentId, patch: { regulatorNotified: true } })}
                className="text-xs text-red-400 hover:underline">Mark regulator notified</button>
            )}
            {!selected.customerNotified && (
              <button onClick={() => updateField.mutate({ id: selected.incidentId, patch: { customerNotified: true } })}
                className="text-xs text-blue-400 hover:underline">Mark customers notified</button>
            )}
            {!selected.closureDateUtc && (
              <button onClick={() => updateField.mutate({ id: selected.incidentId, patch: { closureDateUtc: new Date().toISOString() } })}
                className="text-xs text-green-400 hover:underline">Close incident</button>
            )}
            <span className={`text-xs ml-auto ${selected.regulatorNotified ? 'text-green-400' : 'text-gray-400'}`}>
              {selected.regulatorNotified ? '✓ Regulator notified' : '✗ Regulator not notified'}
            </span>
            <span className={`text-xs ${selected.customerNotified ? 'text-green-400' : 'text-gray-400'}`}>
              {selected.customerNotified ? '✓ Customers notified' : '✗ Customers not notified'}
            </span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : incidents?.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No incidents recorded.</div>
      ) : (
        <div className="space-y-2">
          {incidents?.map((i) => (
            <button key={i.incidentId} onClick={() => setSelected(i)}
              className={`w-full text-left bg-gray-900 border rounded-lg p-4 hover:border-gray-600 transition-colors ${selected?.incidentId === i.incidentId ? 'border-blue-500' : 'border-gray-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded capitalize font-medium ${SEVERITY_BADGE[i.severity]}`}>{i.severity}</span>
                  <span className="text-sm font-medium text-white">{i.incidentCategory}</span>
                  {i.closureDateUtc && <span className="text-xs text-gray-400">Closed</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {i.regulatorNotified && <span className="text-green-400">Regulator ✓</span>}
                  {i.customerNotified && <span className="text-blue-400">Customers ✓</span>}
                  <span>{new Date(i.detectionDateUtc).toLocaleDateString()}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
