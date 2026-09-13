import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api.js';

const INTAKE_SOURCES = ['customer', 'researcher', 'internal', 'public_disclosure', 'nist_nvd', 'cert', 'regulator', 'other'];
const REPORTER_CATEGORIES = ['security_researcher', 'customer', 'employee', 'automated_scanner', 'regulator', 'unknown'];

export default function PsirtNewPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    intakeSource: '',
    reporterCategory: '',
    initialSummary: '',
    productMatchResult: '',
    assignedOwner: '',
    priority: '',
    nextAction: '',
  });

  const create = useMutation({
    mutationFn: () => api.post('/psirt/cases', {
      intakeSource: form.intakeSource,
      reporterCategory: form.reporterCategory || undefined,
      initialSummary: form.initialSummary,
      productMatchResult: form.productMatchResult || undefined,
      assignedOwner: form.assignedOwner || undefined,
      priority: form.priority || undefined,
      nextAction: form.nextAction || undefined,
    }),
    onSuccess: (data) => {
      navigate(`/psirt/${(data as { caseId: string }).caseId}`);
    },
  });

  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <button onClick={() => navigate('/psirt')} className="text-xs text-gray-400 hover:text-gray-200 mb-2 block">← PSIRT queue</button>
        <h1 className="text-lg font-semibold text-white">New PSIRT case</h1>
        <p className="text-sm text-gray-500">Log a new security vulnerability intake</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Summary *</label>
          <textarea rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600"
            value={form.initialSummary} onChange={(e) => set({ initialSummary: e.target.value })}
            placeholder="Describe the reported vulnerability or security issue…" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Intake source *</label>
            <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.intakeSource} onChange={(e) => set({ intakeSource: e.target.value })}>
              <option value="">Select…</option>
              {INTAKE_SOURCES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Reporter category</label>
            <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.reporterCategory} onChange={(e) => set({ reporterCategory: e.target.value })}>
              <option value="">— None —</option>
              {REPORTER_CATEGORIES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Priority</label>
            <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
              <option value="">— None —</option>
              {['P1', 'P2', 'P3', 'P4'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assigned owner</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.assignedOwner} onChange={(e) => set({ assignedOwner: e.target.value })}
              placeholder="name@company.com" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Product match</label>
          <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
            value={form.productMatchResult} onChange={(e) => set({ productMatchResult: e.target.value })}
            placeholder="Product name / version affected" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Next action</label>
          <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
            value={form.nextAction} onChange={(e) => set({ nextAction: e.target.value })}
            placeholder="Reproduce, triage, escalate…" />
        </div>

        {create.error && <p className="text-xs text-red-400">{(create.error as Error).message}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={() => navigate('/psirt')}
            className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Cancel</button>
          <button onClick={() => create.mutate()}
            disabled={!form.intakeSource || !form.initialSummary || create.isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
            {create.isPending ? 'Creating…' : 'Create case'}
          </button>
        </div>
      </div>
    </div>
  );
}
