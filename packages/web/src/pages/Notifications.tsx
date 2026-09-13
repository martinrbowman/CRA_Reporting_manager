import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

interface Notification {
  notificationId: string;
  notificationType: 'customer' | 'regulator' | 'internal' | 'supplier';
  recipientType: string;
  recipient?: string;
  sentAtUtc: string;
  channel?: string;
  subject?: string;
  deliveryStatus: string;
  vulnerabilityId?: string;
  incidentId?: string;
  createdAt: string;
}

const TYPE_BADGE: Record<string, string> = {
  customer: 'bg-blue-900/40 text-blue-300',
  regulator: 'bg-red-900/40 text-red-300',
  internal: 'bg-gray-800 text-gray-400',
  supplier: 'bg-purple-900/40 text-purple-300',
};

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-yellow-900/40 text-yellow-300',
  sent: 'bg-blue-900/40 text-blue-300',
  delivered: 'bg-green-900/40 text-green-300',
  failed: 'bg-red-900/40 text-red-300',
  superseded: 'bg-gray-800 text-gray-500',
};

const NOTIF_TYPES = ['customer', 'regulator', 'internal', 'supplier'] as const;
const CHANNELS = ['Email', 'Portal', 'API', 'Post', 'Phone', 'EUDRA', 'ENISA'];

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [form, setForm] = useState({
    notificationType: 'customer' as typeof NOTIF_TYPES[number],
    recipientType: '',
    recipient: '',
    sentAtUtc: new Date().toISOString().slice(0, 16),
    channel: '',
    subject: '',
    body: '',
    deliveryStatus: 'queued' as const,
  });

  const { data: notifs, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
  });

  const create = useMutation({
    mutationFn: () => api.post('/notifications', {
      ...form,
      sentAtUtc: new Date(form.sentAtUtc).toISOString(),
      recipient: form.recipient || undefined,
      channel: form.channel || undefined,
      subject: form.subject || undefined,
      body: form.body || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setShowForm(false);
    },
  });

  // Real delivery attempt — routes through the server's SMTP config.
  const send = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/send`, {}),
    onSuccess: () => {
      setSendError(null);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e: Error) => setSendError(e.message),
  });

  const markDelivered = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}`, { deliveryStatus: 'delivered' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Notifications</h1>
          <p className="text-sm text-gray-500">Customer, regulator and supplier notifications</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
          + New notification
        </button>
      </div>

      {sendError && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm text-red-300 mb-4">
          Send failed: {sendError}
        </div>
      )}

      {showForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3 mb-6">
          <h3 className="text-sm font-semibold text-gray-300">New notification record</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Type *</label>
              <select className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.notificationType} onChange={(e) => set({ notificationType: e.target.value as typeof NOTIF_TYPES[number] })}>
                {NOTIF_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Recipient type *</label>
              <input className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.recipientType} onChange={(e) => set({ recipientType: e.target.value })}
                placeholder="e.g. End customer, ENISA, NCA" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Recipient (email)</label>
              <input className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.recipient} onChange={(e) => set({ recipient: e.target.value })}
                placeholder="name@example.com" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Sent at *</label>
              <input type="datetime-local" className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.sentAtUtc} onChange={(e) => set({ sentAtUtc: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Channel</label>
              <select className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.channel} onChange={(e) => set({ channel: e.target.value })}>
                <option value="">Select…</option>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Initial delivery status</label>
              <select className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
                value={form.deliveryStatus} onChange={(e) => set({ deliveryStatus: e.target.value as 'queued' })}>
                {['queued', 'sent', 'delivered', 'failed'].map((s) => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Subject</label>
            <input className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
              value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Body / notes</label>
            <textarea rows={3} className="w-full border border-gray-700 rounded-md px-2 py-1.5 text-sm"
              value={form.body} onChange={(e) => set({ body: e.target.value })} />
          </div>
          {create.error && <p className="text-xs text-red-400">{(create.error as Error).message}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm border border-gray-700 rounded-md hover:bg-gray-800/50">Cancel</button>
            <button onClick={() => create.mutate()}
              disabled={!form.recipientType || !form.sentAtUtc || create.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
              {create.isPending ? 'Saving…' : 'Save notification'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : notifs?.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No notifications recorded yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-800/50 text-xs text-gray-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">Recipient</th>
                <th className="text-left px-4 py-2.5 font-medium">Subject</th>
                <th className="text-left px-4 py-2.5 font-medium">Channel</th>
                <th className="text-left px-4 py-2.5 font-medium">Sent</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {notifs?.map((n) => (
                <tr key={n.notificationId} className="hover:bg-gray-800/50">
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize font-medium ${TYPE_BADGE[n.notificationType]}`}>
                      {n.notificationType}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-300">
                    <div>{n.recipientType}</div>
                    {n.recipient && <div className="text-xs text-gray-500">{n.recipient}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 max-w-xs truncate">{n.subject ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{n.channel ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {new Date(n.sentAtUtc).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${STATUS_BADGE[n.deliveryStatus]}`}>
                      {n.deliveryStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {n.deliveryStatus === 'queued' && (
                      <button onClick={() => send.mutate(n.notificationId)}
                        disabled={send.isPending}
                        className="text-blue-400 hover:underline disabled:opacity-40">Send</button>
                    )}
                    {n.deliveryStatus === 'sent' && (
                      <button onClick={() => markDelivered.mutate(n.notificationId)}
                        className="text-green-400 hover:underline">Mark delivered</button>
                    )}
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
