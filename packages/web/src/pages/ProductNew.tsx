import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface Manufacturer {
  manufacturerId: string;
  legalName: string;
  displayName?: string;
}

const PRODUCT_TYPES = ['hardware', 'software', 'firmware', 'mixed'] as const;
const PRODUCT_CLASSES = ['default', 'important1', 'important2', 'critical'] as const;
const CLASS_LABELS: Record<string, string> = {
  default: 'Default',
  important1: 'Important (Class I)',
  important2: 'Important (Class II)',
  critical: 'Critical',
};

function TagInput({ label, value, onChange, placeholder }: {
  label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState('');
  function add(val: string) {
    const v = val.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput('');
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded">
            {v}
            <button onClick={() => onChange(value.filter((x) => x !== v))} className="text-blue-300 hover:text-white">✕</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
          value={input}
          placeholder={placeholder ?? 'Type and press Enter'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add(input))}
        />
        <button onClick={() => add(input)}
          className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Add</button>
      </div>
    </div>
  );
}

export default function ProductNewPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'manufacturer' | 'product'>('manufacturer');
  const [manufacturerId, setManufacturerId] = useState('');
  const [newMfg, setNewMfg] = useState({ legalName: '', displayName: '', euEstablishmentCountry: '', contactEmail: '' });
  const [creatingMfg, setCreatingMfg] = useState(false);

  const [form, setForm] = useState({
    productName: '',
    modelNumber: '',
    sku: '',
    productType: 'hardware' as typeof PRODUCT_TYPES[number],
    productClass: 'default' as typeof PRODUCT_CLASSES[number],
    intendedUse: '',
    firstPlacedOnMarketDate: '',
    productOwner: '',
    securityOwner: '',
    engineeringOwner: '',
    psirtLead: '',
    supportEscalationContacts: [] as string[],
  });

  const { data: manufacturers } = useQuery<Manufacturer[]>({
    queryKey: ['manufacturers'],
    queryFn: () => api.get('/manufacturers'),
  });

  const createMfgMutation = useMutation({
    mutationFn: () => api.post<Manufacturer>('/manufacturers', {
      legalName: newMfg.legalName,
      displayName: newMfg.displayName || undefined,
      euEstablishmentCountry: newMfg.euEstablishmentCountry || undefined,
      contactEmail: newMfg.contactEmail || undefined,
    }),
    onSuccess: (mfg) => {
      setManufacturerId(mfg.manufacturerId);
      setCreatingMfg(false);
      setStep('product');
    },
  });

  const createProductMutation = useMutation({
    mutationFn: () => api.post<{ productId: string }>('/products', {
      manufacturerId,
      productName: form.productName,
      modelNumber: form.modelNumber || undefined,
      sku: form.sku || undefined,
      productType: form.productType,
      productClass: form.productClass,
      intendedUse: form.intendedUse || undefined,
      firstPlacedOnMarketDate: form.firstPlacedOnMarketDate || undefined,
      productOwner: form.productOwner || undefined,
      securityOwner: form.securityOwner || undefined,
      engineeringOwner: form.engineeringOwner || undefined,
      psirtLead: form.psirtLead || undefined,
      supportEscalationContacts: form.supportEscalationContacts,
    }),
    onSuccess: (p) => navigate(`/products/${p.productId}`),
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // ── Step 1: Manufacturer ────────────────────────────────────────────────────

  if (step === 'manufacturer') {
    return (
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-semibold text-white mb-1">New Product</h1>
        <p className="text-sm text-gray-500 mb-6">Step 1 of 2 — Select or create manufacturer</p>

        {manufacturers && manufacturers.length > 0 && !creatingMfg && (
          <div className="space-y-2 mb-4">
            {manufacturers.map((m) => (
              <label key={m.manufacturerId}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  manufacturerId === m.manufacturerId ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <input type="radio" name="mfg" value={m.manufacturerId} checked={manufacturerId === m.manufacturerId}
                  onChange={() => setManufacturerId(m.manufacturerId)} className="accent-blue-600" />
                <div>
                  <p className="text-sm font-medium text-white">{m.displayName ?? m.legalName}</p>
                  {m.displayName && <p className="text-xs text-gray-500">{m.legalName}</p>}
                </div>
              </label>
            ))}
          </div>
        )}

        {!creatingMfg ? (
          <button onClick={() => setCreatingMfg(true)}
            className="text-sm text-blue-400 hover:underline mb-6 block">
            + Create new manufacturer
          </button>
        ) : (
          <div className="border border-gray-700 rounded-lg p-4 space-y-3 mb-6">
            <h3 className="text-sm font-medium text-gray-300">New manufacturer</h3>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Legal name *</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
                value={newMfg.legalName} onChange={(e) => setNewMfg((x) => ({ ...x, legalName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Display name</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
                  value={newMfg.displayName} onChange={(e) => setNewMfg((x) => ({ ...x, displayName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">EU country</label>
                <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
                  value={newMfg.euEstablishmentCountry} onChange={(e) => setNewMfg((x) => ({ ...x, euEstablishmentCountry: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Contact email</label>
              <input type="email" className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white"
                value={newMfg.contactEmail} onChange={(e) => setNewMfg((x) => ({ ...x, contactEmail: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setCreatingMfg(false)}
                className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Cancel</button>
              <button onClick={() => createMfgMutation.mutate()} disabled={!newMfg.legalName || createMfgMutation.isPending}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
                {createMfgMutation.isPending ? 'Creating…' : 'Create & continue'}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button onClick={() => navigate('/products')}
            className="px-4 py-2 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Cancel</button>
          <button onClick={() => setStep('product')} disabled={!manufacturerId}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Product details ─────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-white mb-1">New Product</h1>
      <p className="text-sm text-gray-500 mb-6">Step 2 of 2 — Product details</p>

      <div className="space-y-6">
        {/* Identity */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 border-b border-gray-800 pb-1">Identity</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Product name *</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
              value={form.productName} onChange={(e) => set({ productName: e.target.value })}
              placeholder="e.g. SecureSense Hub v2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Model number</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.modelNumber} onChange={(e) => set({ modelNumber: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">SKU</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.sku} onChange={(e) => set({ sku: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Product type *</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.productType} onChange={(e) => set({ productType: e.target.value as typeof PRODUCT_TYPES[number] })}>
                {PRODUCT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">CRA class</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.productClass} onChange={(e) => set({ productClass: e.target.value as typeof PRODUCT_CLASSES[number] })}>
                {PRODUCT_CLASSES.map((c) => <option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Intended use</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.intendedUse} onChange={(e) => set({ intendedUse: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">First placed on market</label>
              <input type="date" className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.firstPlacedOnMarketDate} onChange={(e) => set({ firstPlacedOnMarketDate: e.target.value })} />
            </div>
          </div>
        </section>

        {/* Ownership */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 border-b border-gray-800 pb-1">Ownership</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Product owner</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.productOwner} onChange={(e) => set({ productOwner: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Security owner</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.securityOwner} onChange={(e) => set({ securityOwner: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Engineering owner</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.engineeringOwner} onChange={(e) => set({ engineeringOwner: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">PSIRT lead</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
                value={form.psirtLead} onChange={(e) => set({ psirtLead: e.target.value })} />
            </div>
          </div>
        </section>

        {/* Support escalation */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 border-b border-gray-800 pb-1">Support escalation</h2>
          <TagInput label="Support escalation contacts" value={form.supportEscalationContacts}
            onChange={(v) => set({ supportEscalationContacts: v })}
            placeholder="name@company.com" />
        </section>

        {createProductMutation.error && (
          <p className="text-sm text-red-400">{(createProductMutation.error as Error).message}</p>
        )}

        <div className="flex justify-between pt-2">
          <button onClick={() => setStep('manufacturer')}
            className="px-4 py-2 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Back</button>
          <button onClick={() => createProductMutation.mutate()}
            disabled={!form.productName || createProductMutation.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-40">
            {createProductMutation.isPending ? 'Creating…' : 'Create product'}
          </button>
        </div>
      </div>
    </div>
  );
}
