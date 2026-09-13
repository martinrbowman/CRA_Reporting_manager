import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { hasPermission } from '../lib/auth.js';

type Tab = 'users' | 'audit' | 'backups' | 'smtp' | 'oauth' | 'ldap';

interface User {
  userId: string;
  email: string;
  name: string;
  organization?: string;
  department?: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface AuditEvent {
  auditEventId: string;
  actor: string;
  action: string;
  objectType: string;
  objectId: string;
  eventTimestampUtc: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-900/50 text-green-300',
  suspended: 'bg-yellow-900/50 text-yellow-300',
  disabled: 'bg-red-900/50 text-red-300',
  pending: 'bg-gray-800 text-gray-400',
};

const ACTION_COLOR: Record<string, string> = {
  create: 'text-green-400',
  update: 'text-blue-400',
  delete: 'text-red-400',
  deactivate: 'text-orange-400',
  reset_password: 'text-yellow-400',
  login: 'text-gray-400',
  logout: 'text-gray-500',
  patch: 'text-blue-400',
};

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('users');
  const isAdmin = hasPermission('users:write');

  const tabs: [Tab, string][] = [
    ['users', 'Users'],
    ['audit', 'Audit Log'],
    ['backups', 'Backups'],
    ...(isAdmin ? [['smtp', 'Email (SMTP)'], ['oauth', 'OAuth / SSO'], ['ldap', 'LDAP / AD']] as [Tab, string][] : []),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">User management, audit log and platform configuration</p>
      </div>

      <div className="flex gap-1 border-b border-gray-800 flex-wrap">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'users'   && <UsersTab />}
      {tab === 'audit'   && <AuditTab />}
      {tab === 'backups' && <BackupsTab />}
      {tab === 'smtp'    && isAdmin && <SmtpTab />}
      {tab === 'oauth'   && isAdmin && <OauthTab />}
      {tab === 'ldap'    && isAdmin && <LdapTab />}
    </div>
  );
}

interface Role { roleId: string; roleName: string; description: string | null; permissions: string[]; }

function UsersTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({ email: '', name: '', password: '', organization: '', department: '', roleId: '' });
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [roleForm, setRoleForm] = useState<{ roleName: string; description: string; permissions: string[] }>({
    roleName: '', description: '', permissions: [],
  });

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles'),
  });

  // All permission strings that exist across any role — used to build the
  // "new role" checkbox list without hardcoding them here.
  const { data: allPermissions } = useQuery<string[]>({
    queryKey: ['permissions'],
    queryFn: () => api.get('/permissions'),
  });

  const createRole = useMutation({
    mutationFn: () => api.post('/roles', {
      roleName: roleForm.roleName,
      description: roleForm.description || undefined,
      permissions: roleForm.permissions,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setShowRoleForm(false);
      setRoleForm({ roleName: '', description: '', permissions: [] });
    },
  });

  function togglePermission(p: string) {
    setRoleForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }));
  }

  const createUser = useMutation({
    mutationFn: () => api.post('/users', {
      email: form.email,
      name: form.name,
      password: form.password,
      organization: form.organization || undefined,
      department: form.department || undefined,
      roleIds: form.roleId ? [form.roleId] : [],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setForm({ email: '', name: '', password: '', organization: '', department: '', roleId: '' });
    },
  });

  const deactivate = useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const resetPassword = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      api.post(`/users/${userId}/reset-password`, { newPassword }),
    onSuccess: () => {
      setResetTarget(null);
      setNewPassword('');
    },
  });

  const reactivate = useMutation({
    mutationFn: (userId: string) => api.patch(`/users/${userId}`, { status: 'active' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{users?.length ?? 0} user{users?.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowForm((s) => !s)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors">
          + New user
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Create user</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Full name *</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email *</label>
              <input type="email" className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="jane@company.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password *</label>
              <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.password} onChange={(e) => set({ password: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Organization</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.organization} onChange={(e) => set({ organization: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Department</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.department} onChange={(e) => set({ department: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Role</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={form.roleId} onChange={(e) => set({ roleId: e.target.value })}>
                <option value="">No role</option>
                {roles?.map((r) => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500">Password must be at least 12 characters.</p>
          {createUser.error && <p className="text-xs text-red-400">{(createUser.error as Error).message}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Cancel</button>
            <button onClick={() => createUser.mutate()}
              disabled={!form.email || !form.name || form.password.length < 12 || createUser.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
              {createUser.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 w-80 space-y-3">
            <h3 className="text-sm font-semibold text-white">Reset password — {resetTarget.name}</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1">New password *</label>
              <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
            </div>
            {resetPassword.error && <p className="text-xs text-red-400">{(resetPassword.error as Error).message}</p>}
            {resetPassword.isSuccess && <p className="text-xs text-green-400">Password updated.</p>}
            <div className="flex gap-2">
              <button onClick={() => { setResetTarget(null); setNewPassword(''); }}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Cancel</button>
              <button onClick={() => resetPassword.mutate({ userId: resetTarget.userId, newPassword })}
                disabled={newPassword.length < 8 || resetPassword.isPending}
                className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
                {resetPassword.isPending ? 'Saving…' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Department</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Last login</th>
                <th className="text-left px-4 py-3 font-medium">MFA</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users?.map((u) => (
                <tr key={u.userId} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.department ?? u.organization ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${STATUS_COLOR[u.status] ?? 'bg-gray-800 text-gray-400'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={u.mfaEnabled ? 'text-green-400' : 'text-gray-400'}>
                      {u.mfaEnabled ? '✓' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setResetTarget(u)}
                        className="text-xs text-blue-400 hover:underline">Reset pwd</button>
                      {u.status === 'disabled' ? (
                        <button onClick={() => reactivate.mutate(u.userId)}
                          className="text-xs text-green-400 hover:underline">Reactivate</button>
                      ) : (
                        <button onClick={() => {
                          if (confirm(`Deactivate ${u.name}?`)) deactivate.mutate(u.userId);
                        }} className="text-xs text-red-400 hover:underline">Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Roles */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-800">
        <p className="text-sm text-gray-400">{roles?.length ?? 0} role{roles?.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowRoleForm((s) => !s)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors">
          + New role
        </button>
      </div>

      {showRoleForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Create role</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Role name *</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={roleForm.roleName} onChange={(e) => setRoleForm((f) => ({ ...f, roleName: e.target.value }))}
                placeholder="reporting_officer" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
                value={roleForm.description} onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {allPermissions?.map((p) => (
                <label key={p}
                  className={`text-xs px-2 py-1 rounded cursor-pointer border ${roleForm.permissions.includes(p) ? 'bg-blue-900/40 border-blue-700 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                  <input type="checkbox" className="hidden" checked={roleForm.permissions.includes(p)}
                    onChange={() => togglePermission(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
          {createRole.error && <p className="text-xs text-red-400">{(createRole.error as Error).message}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShowRoleForm(false)}
              className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">Cancel</button>
            <button onClick={() => createRole.mutate()}
              disabled={!roleForm.roleName || createRole.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
              {createRole.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
        {roles?.map((r) => (
          <div key={r.roleId} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">{r.roleName}</p>
              <p className="text-xs text-gray-500">{r.permissions.length} permission{r.permissions.length !== 1 ? 's' : ''}</p>
            </div>
            {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
            {r.permissions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {r.permissions.map((p) => (
                  <span key={p} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{p}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Matches the exact objectType strings audit() is ever called with across
// the API (grepped, not guessed) — 'approval' was never one of them (approval
// decisions are logged under the approved/rejected object's own type, e.g.
// psirt_case), and 'database' (backup/restore) was missing.
const OBJECT_TYPES = ['', 'user', 'product', 'manufacturer', 'version', 'vulnerability', 'vulnerability_event', 'psirt_case', 'incident', 'patch', 'notification', 'cra_report', 'role', 'platform_setting', 'database'];

function AuditTab() {
  const [filters, setFilters] = useState({ objectType: '', actor: '', from: '', to: '' });
  const [applied, setApplied] = useState({ objectType: '', actor: '', from: '', to: '' });

  const params = new URLSearchParams();
  if (applied.objectType) params.set('objectType', applied.objectType);
  if (applied.actor) params.set('actor', applied.actor);
  if (applied.from) params.set('from', new Date(applied.from).toISOString());
  if (applied.to) params.set('to', new Date(applied.to).toISOString());
  params.set('limit', '200');

  const { data: events, isLoading, refetch } = useQuery<AuditEvent[]>({
    queryKey: ['audit-log', applied],
    queryFn: () => api.get(`/audit-log?${params.toString()}`),
  });

  const setF = (p: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...p }));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Object type</label>
          <select className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
            value={filters.objectType} onChange={(e) => setF({ objectType: e.target.value })}>
            {OBJECT_TYPES.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Actor (email)</label>
          <input className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white w-44"
            value={filters.actor} onChange={(e) => setF({ actor: e.target.value })}
            placeholder="Filter by actor…" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <input type="datetime-local" className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
            value={filters.from} onChange={(e) => setF({ from: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <input type="datetime-local" className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
            value={filters.to} onChange={(e) => setF({ to: e.target.value })} />
        </div>
        <button onClick={() => setApplied({ ...filters })}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
          Apply
        </button>
        <button onClick={() => { setFilters({ objectType: '', actor: '', from: '', to: '' }); setApplied({ objectType: '', actor: '', from: '', to: '' }); }}
          className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">
          Clear
        </button>
        <button onClick={() => refetch()}
          className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800">
          ↻ Refresh
        </button>
        <span className="text-xs text-gray-500 ml-auto">{events?.length ?? 0} events (max 200)</span>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : events?.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-8 text-center text-sm text-gray-400">
          No audit events match filters.
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium">Actor</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Object type</th>
                <th className="text-left px-4 py-3 font-medium">Object ID</th>
                <th className="text-left px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {events?.map((e) => (
                <tr key={e.auditEventId} className="hover:bg-gray-800/30 font-mono">
                  <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                    {new Date(e.eventTimestampUtc).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-gray-300">{e.actor}</td>
                  <td className={`px-4 py-2 font-semibold ${ACTION_COLOR[e.action] ?? 'text-gray-300'}`}>
                    {e.action}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{e.objectType}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{e.objectId.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-gray-400">{e.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SMTP Tab ──────────────────────────────────────────────────────────────────

interface SmtpConfig { host: string; port: number; secure: boolean; user: string; pass: string; from: string; }

function SmtpTab() {
  const qc = useQueryClient();
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState('');

  const { data, isLoading } = useQuery<SmtpConfig>({
    queryKey: ['settings-smtp'],
    queryFn: () => api.get('/settings/smtp'),
  });

  const [form, setForm] = useState<SmtpConfig>({ host: '', port: 587, secure: false, user: '', pass: '', from: '' });
  const set = (p: Partial<SmtpConfig>) => setForm((f) => ({ ...f, ...p }));

  if (!isLoading && data && form.host === '' && data.host !== undefined) {
    setForm(data);
  }

  const save = useMutation({
    mutationFn: () => api.patch('/settings/smtp', form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-smtp'] }),
  });

  const test = useMutation({
    mutationFn: () => api.post('/settings/smtp/test', { to: testEmail || undefined }),
    onSuccess: () => setTestResult('Test email sent.'),
    onError: (e) => setTestResult((e as Error).message),
  });

  if (isLoading) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-xs text-gray-500">Configure outbound email for notifications. Leave host blank to disable email.</p>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">SMTP Host</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.host} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.example.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Port</label>
            <input type="number" className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.port} onChange={(e) => set({ port: Number(e.target.value) })} />
          </div>
          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.secure} onChange={(e) => set({ secure: e.target.checked })}
                className="rounded border-gray-600" />
              TLS (port 465)
            </label>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Username</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.user} onChange={(e) => set({ user: e.target.value })} placeholder="user@example.com" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Password</label>
            <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.pass} onChange={(e) => set({ pass: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">From address</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={form.from} onChange={(e) => set({ from: e.target.value })} placeholder="cra-platform@company.com" />
          </div>
        </div>
        {save.error && <p className="text-xs text-red-400">{(save.error as Error).message}</p>}
        {save.isSuccess && <p className="text-xs text-green-400">Saved.</p>}
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Send test email</h3>
        <div className="flex gap-2">
          <input className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
            value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="recipient@example.com (blank = your account)" />
          <button onClick={() => { setTestResult(''); test.mutate(); }} disabled={test.isPending}
            className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-40">
            {test.isPending ? 'Sending…' : 'Send test'}
          </button>
        </div>
        {testResult && <p className={`text-xs ${testResult === 'Test email sent.' ? 'text-green-400' : 'text-red-400'}`}>{testResult}</p>}
      </div>
    </div>
  );
}

// ── OAuth Tab — only Microsoft Entra ID + generic OIDC exist in this fork ──────

interface OauthProvider { enabled: boolean; clientId: string; clientSecret: string; tenantId?: string; discoveryUrl?: string; }
interface OauthCfg { microsoft: OauthProvider; oidc: OauthProvider; }

function OauthProviderForm({ label, value, onChange, extraFields }: {
  label: string;
  value: OauthProvider;
  onChange: (v: OauthProvider) => void;
  extraFields?: React.ReactNode;
}) {
  const set = (p: Partial<OauthProvider>) => onChange({ ...value, ...p });
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">{label}</h3>
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
          <input type="checkbox" checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          Enabled
        </label>
      </div>
      {value.enabled && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Client ID</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white font-mono"
              value={value.clientId} onChange={(e) => set({ clientId: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Client Secret</label>
            <input type="password" className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white"
              value={value.clientSecret} onChange={(e) => set({ clientSecret: e.target.value })} placeholder="leave blank to keep existing" />
          </div>
          {extraFields}
        </div>
      )}
    </div>
  );
}

function OauthTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<OauthCfg>({
    queryKey: ['settings-oauth'],
    queryFn: () => api.get('/settings/oauth'),
  });

  const defaults: OauthCfg = {
    microsoft: { enabled: false, clientId: '', clientSecret: '', tenantId: 'organizations' },
    oidc:      { enabled: false, clientId: '', clientSecret: '', discoveryUrl: '' },
  };
  const [form, setForm] = useState<OauthCfg>(defaults);
  const set = (k: keyof OauthCfg) => (v: OauthProvider) => setForm((f) => ({ ...f, [k]: v }));

  if (!isLoading && data && !form.microsoft.clientId && data.microsoft.clientId) setForm(data);

  const save = useMutation({
    mutationFn: () => api.patch('/settings/oauth', form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings-oauth'] }),
  });

  const callbackBase = `${window.location.origin.replace(/:\d+$/, ':3001')}/api/v1/oauth`;

  if (isLoading) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="space-y-3 max-w-xl">
      <p className="text-xs text-gray-500">
        Configure OAuth 2.0 providers. Add <code className="text-gray-300">/api/v1/oauth/&#123;provider&#125;/callback</code> as the redirect URI in each provider's app settings.
      </p>
      <div className="bg-gray-800/50 border border-gray-700 rounded p-2 text-xs font-mono text-gray-400 space-y-0.5">
        {(['microsoft', 'oidc'] as const).map((p) => (
          <div key={p}>{callbackBase}/{p}/callback</div>
        ))}
      </div>

      <OauthProviderForm label="Microsoft Entra ID" value={form.microsoft} onChange={set('microsoft')}
        extraFields={
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Tenant ID (or "organizations")</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white font-mono"
              value={form.microsoft.tenantId ?? ''} onChange={(e) => set('microsoft')({ ...form.microsoft, tenantId: e.target.value })} />
          </div>
        } />
      <OauthProviderForm label="Generic OIDC (Keycloak / Okta / Auth0)" value={form.oidc} onChange={set('oidc')}
        extraFields={
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Discovery URL (issuer base)</label>
            <input className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white font-mono"
              value={form.oidc.discoveryUrl ?? ''} onChange={(e) => set('oidc')({ ...form.oidc, discoveryUrl: e.target.value })}
              placeholder="https://auth.company.com/realms/myrealm" />
          </div>
        } />

      {save.error && <p className="text-xs text-red-400">{(save.error as Error).message}</p>}
      {save.isSuccess && <p className="text-xs text-green-400">Saved.</p>}
      <button onClick={() => save.mutate()} disabled={save.isPending}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
        {save.isPending ? 'Saving…' : 'Save OAuth settings'}
      </button>
    </div>
  );
}

// ── LDAP / AD Tab — read-only status view (file-based config, never edited
// via the API). Test Connection + Reload Config only. ─────────────────────────

interface GroupRoleMapEntry { group: string; role: string; }

interface LdapStatus {
  configured?: boolean;
  enabled?: boolean;
  host?: string;
  port?: number;
  useTLS?: boolean;
  bindDN?: string;
  bindCredentials?: string;
  userSearchBase?: string;
  userSearchFilter?: string;
  groupSearchBase?: string;
  groupSearchAttr?: string;
  groupRoleMap?: GroupRoleMapEntry[];
  defaultRole?: string;
}

function LdapTab() {
  const qc = useQueryClient();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data, isLoading } = useQuery<LdapStatus>({
    queryKey: ['settings-ldap'],
    queryFn: () => api.get('/settings/ldap'),
  });

  const test = useMutation({
    mutationFn: () => api.post('/settings/ldap/test', {}),
    onSuccess: () => setTestResult({ ok: true, message: 'Connection succeeded — bind credentials are valid.' }),
    onError: (e: Error) => setTestResult({ ok: false, message: e.message }),
  });

  const reload = useMutation({
    mutationFn: () => api.post<LdapStatus>('/settings/ldap/reload', {}),
    onSuccess: () => {
      setTestResult(null);
      qc.invalidateQueries({ queryKey: ['settings-ldap'] });
    },
  });

  if (isLoading) return <div className="text-sm text-gray-500">Loading…</div>;

  if (!data || data.configured === false) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">
            No <code className="text-gray-300">config/ldap.yml</code> found — AD/LDAP authentication is not configured.
            This is an ops-managed file; it cannot be created or edited from this UI.
          </p>
        </div>
        <button onClick={() => reload.mutate()} disabled={reload.isPending}
          className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800 disabled:opacity-40">
          {reload.isPending ? 'Reloading…' : 'Reload config'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-xs text-gray-500">
        LDAP/AD configuration is read from <code className="text-gray-300">config/ldap.yml</code> on the API server —
        it is ops-managed and cannot be edited here. Use the buttons below to verify connectivity or pick up file changes.
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</h3>
          <span className={`text-xs px-1.5 py-0.5 rounded ${data.enabled ? 'bg-green-900/50 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
            {data.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Host</dt>
            <dd className="text-gray-200 font-mono">{data.host ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Port</dt>
            <dd className="text-gray-200 font-mono">{data.port ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">TLS</dt>
            <dd className="text-gray-200">{data.useTLS ? 'Yes (ldaps://)' : 'No (ldap://)'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Bind DN</dt>
            <dd className="text-gray-200 font-mono text-xs break-all">{data.bindDN ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Bind credentials</dt>
            <dd className="text-gray-200 font-mono">{data.bindCredentials ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 mb-0.5">Default role</dt>
            <dd className="text-gray-200">{data.defaultRole ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-gray-500 mb-0.5">User search base</dt>
            <dd className="text-gray-200 font-mono text-xs break-all">{data.userSearchBase ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-gray-500 mb-0.5">User search filter</dt>
            <dd className="text-gray-200 font-mono text-xs break-all">{data.userSearchFilter ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-gray-500 mb-0.5">Group search base</dt>
            <dd className="text-gray-200 font-mono text-xs break-all">{data.groupSearchBase ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-gray-500 mb-0.5">Group search attribute</dt>
            <dd className="text-gray-200 font-mono text-xs">{data.groupSearchAttr ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Group → role mapping</h3>
        {data.groupRoleMap && data.groupRoleMap.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left py-2 font-medium">Directory group</th>
                <th className="text-left py-2 font-medium">Mapped role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.groupRoleMap.map((m, i) => (
                <tr key={i}>
                  <td className="py-2 text-gray-200 font-mono text-xs">{m.group}</td>
                  <td className="py-2 text-gray-300">{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">No group→role mappings configured.</p>
        )}
      </div>

      {testResult && (
        <div className={`rounded-lg border p-3 text-sm ${testResult.ok ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
          {testResult.message}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => { setTestResult(null); test.mutate(); }} disabled={test.isPending}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40">
          {test.isPending ? 'Testing…' : 'Test connection'}
        </button>
        <button onClick={() => reload.mutate()} disabled={reload.isPending}
          className="px-3 py-1.5 text-sm border border-gray-700 text-gray-400 rounded-md hover:bg-gray-800 disabled:opacity-40">
          {reload.isPending ? 'Reloading…' : 'Reload config'}
        </button>
      </div>
    </div>
  );
}

interface Backup { filename: string; size: number; createdAt: string; }

function BackupsTab() {
  const qc = useQueryClient();
  const [restoreError, setRestoreError] = useState('');
  const [restoreOk, setRestoreOk] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const { data: backups, isLoading, refetch } = useQuery<Backup[]>({
    queryKey: ['backups'],
    queryFn: () => api.get('/admin/backups'),
  });

  const createBackup = useMutation({
    mutationFn: () => api.post('/admin/backup', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const deleteBackup = useMutation({
    mutationFn: (filename: string) => api.delete(`/admin/backups/${encodeURIComponent(filename)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  function fmtSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function downloadBackup(filename: string) {
    const token = localStorage.getItem('accessToken');
    fetch(`/api/v1/admin/backups/${encodeURIComponent(filename)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  async function handleRestoreUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(`Restore from "${file.name}"? This will OVERWRITE all current data.`)) return;

    setRestoring(true);
    setRestoreError('');
    setRestoreOk(false);

    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/v1/admin/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setRestoreError(json.error ?? 'Restore failed');
      } else {
        setRestoreOk(true);
        refetch();
      }
    } catch (err) {
      setRestoreError((err as Error).message);
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{backups?.length ?? 0} backup{backups?.length !== 1 ? 's' : ''} stored</p>
          <p className="text-xs text-gray-500 mt-0.5">Format: PostgreSQL custom dump (.dump) — retained per CRA Art. 13</p>
        </div>
        <button onClick={() => createBackup.mutate()}
          disabled={createBackup.isPending}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors">
          {createBackup.isPending ? 'Creating…' : '+ Create backup now'}
        </button>
      </div>

      {createBackup.error && (
        <p className="text-xs text-red-400">{(createBackup.error as Error).message}</p>
      )}

      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Restore from file</h3>
        <p className="text-xs text-gray-500 mb-3">Upload a .dump file. Overwrites all current data — cannot be undone.</p>
        <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${restoring ? 'bg-gray-700 text-gray-500' : 'bg-red-900/50 text-red-300 hover:bg-red-900/70 border border-red-800'}`}>
          {restoring ? 'Restoring…' : 'Choose .dump file to restore'}
          <input type="file" accept=".dump,.sql" className="hidden" onChange={handleRestoreUpload} disabled={restoring} />
        </label>
        {restoreError && <p className="mt-2 text-xs text-red-400">{restoreError}</p>}
        {restoreOk && <p className="mt-2 text-xs text-green-400">Restore completed successfully.</p>}
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : backups?.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-8 text-center text-sm text-gray-500">
          No backups yet. Create one above.
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Filename</th>
                <th className="text-left px-4 py-3 font-medium">Size</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {backups?.map((b) => (
                <tr key={b.filename} className="hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">{b.filename}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{fmtSize(b.size)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => downloadBackup(b.filename)}
                        className="text-xs text-blue-400 hover:underline">Download</button>
                      <button onClick={() => {
                        if (confirm(`Delete ${b.filename}?`)) deleteBackup.mutate(b.filename);
                      }} className="text-xs text-red-400 hover:underline">Delete</button>
                    </div>
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
