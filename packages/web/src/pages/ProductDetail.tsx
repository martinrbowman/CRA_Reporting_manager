import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface Product {
  productId: string;
  manufacturerId: string;
  productName: string;
  modelNumber?: string;
  sku?: string;
  productClass: string;
  productType: string;
  status: string;
  intendedUse?: string;
  firstPlacedOnMarketDate?: string;
  productOwner?: string;
  securityOwner?: string;
  engineeringOwner?: string;
  psirtLead?: string;
  supportEscalationContacts: string[];
  createdAt: string;
  updatedAt: string;
}

const CLASS_LABELS: Record<string, string> = {
  default: 'Default', important1: 'Important (Class I)',
  important2: 'Important (Class II)', critical: 'Critical',
};

const ACTION_CARDS = [
  { label: 'Versions', desc: 'Product releases and build history', href: (id: string) => `/products/${id}/versions`, color: 'border-blue-900 hover:border-blue-500' },
  { label: 'Vulnerabilities', desc: 'Track and manage security vulnerabilities', href: () => `/vulnerabilities`, color: 'border-red-900 hover:border-red-500' },
  { label: 'PSIRT Cases', desc: 'Security incident response cases', href: () => `/psirt`, color: 'border-yellow-900 hover:border-yellow-500' },
];

function Field({ label, value }: { label: string; value?: string | boolean | string[] | null }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value)
    ? value.join(', ')
    : typeof value === 'boolean'
      ? (value ? 'Yes' : 'No')
      : value;
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-white mt-0.5">{display}</dd>
    </div>
  );
}

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['product', productId],
    queryFn: () => api.get(`/products/${productId}`),
    enabled: !!productId,
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (!product) return <div className="p-6 text-sm text-red-400">Product not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/products')} className="text-xs text-gray-400 hover:text-gray-200 mb-2 block">
            ← Products
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">{product.productName}</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 capitalize">{product.status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {CLASS_LABELS[product.productClass] ?? product.productClass} · {product.productType}
            {product.modelNumber && ` · ${product.modelNumber}`}
          </p>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-3 gap-3">
        {ACTION_CARDS.map((card) => (
          <Link
            key={card.label}
            to={card.href(product.productId)}
            className={`border rounded-lg p-4 transition-colors ${card.color}`}
          >
            <p className="text-sm font-medium text-white">{card.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.desc}</p>
          </Link>
        ))}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Product details</h2>
          <dl className="space-y-2">
            <Field label="Intended use" value={product.intendedUse} />
            <Field label="First placed on market" value={product.firstPlacedOnMarketDate} />
            <Field label="Support escalation contacts" value={product.supportEscalationContacts} />
          </dl>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ownership</h2>
          <dl className="space-y-2">
            <Field label="Product owner" value={product.productOwner} />
            <Field label="Security owner" value={product.securityOwner} />
            <Field label="Engineering owner" value={product.engineeringOwner} />
            <Field label="PSIRT lead" value={product.psirtLead} />
          </dl>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-4">Identifiers</h2>
          <dl className="space-y-2">
            <Field label="Model number" value={product.modelNumber} />
            <Field label="SKU" value={product.sku} />
            <Field label="Product ID" value={product.productId} />
          </dl>
        </div>
      </div>
    </div>
  );
}
