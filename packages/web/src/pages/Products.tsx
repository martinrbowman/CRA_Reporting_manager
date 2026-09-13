import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { format } from 'date-fns';

interface Product {
  productId: string;
  productName: string;
  modelNumber: string | null;
  productClass: string;
  productType: string;
  status: string;
  firstPlacedOnMarketDate: string | null;
  createdAt: string;
}

const CLASS_LABELS: Record<string, string> = {
  default: 'Default',
  important1: 'Important (Class I)',
  important2: 'Important (Class II)',
  critical: 'Critical',
};

export default function ProductsPage() {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{products?.length ?? 0} registered</p>
        </div>
        <Link
          to="/products/new"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
        >
          Add product
        </Link>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-400">{String(error)}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Product</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Class</th>
              <th className="text-left px-4 py-3 font-medium">First placed on market</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {products?.map((p) => (
              <tr key={p.productId} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div>
                      <Link
                        to={`/products/${p.productId}`}
                        className="text-white hover:text-blue-400 font-medium transition-colors"
                      >
                        {p.productName}
                      </Link>
                      {p.modelNumber && (
                        <p className="text-xs text-gray-500">{p.modelNumber}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 capitalize">{p.productType}</td>
                <td className="px-4 py-3 text-gray-400">{CLASS_LABELS[p.productClass] ?? p.productClass}</td>
                <td className="px-4 py-3 text-gray-400">
                  {p.firstPlacedOnMarketDate
                    ? format(new Date(p.firstPlacedOnMarketDate), 'dd MMM yyyy')
                    : <span className="text-gray-400">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    p.status === 'active'
                      ? 'bg-green-900 text-green-300'
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link to={`/products/${p.productId}`}>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </td>
              </tr>
            ))}
            {products?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No products registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
