import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, UserX, Key, Shield, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../lib/api.js';

type UserStatus = 'active' | 'suspended' | 'disabled' | 'pending';

interface User {
  userId: string;
  email: string;
  name: string;
  organization: string | null;
  department: string | null;
  status: UserStatus;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Role {
  roleId: string;
  roleName: string;
  description: string | null;
}

const STATUS_STYLE: Record<UserStatus, string> = {
  active: 'bg-green-900/50 text-green-300',
  suspended: 'bg-yellow-900/50 text-yellow-300',
  disabled: 'bg-gray-800 text-gray-500',
  pending: 'bg-blue-900/50 text-blue-300',
};

interface InviteFormProps {
  roles: Role[];
  onClose: () => void;
  onSuccess: () => void;
}

function InviteForm({ roles, onClose, onSuccess }: InviteFormProps) {
  const [form, setForm] = useState({
    email: '', name: '', password: '', organization: '',
    department: '', jobFunction: '', roleIds: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post('/users', form),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const toggleRole = (id: string) =>
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(id) ? f.roleIds.filter((r) => r !== id) : [...f.roleIds, id],
    }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-lg space-y-3">
        <h2 className="text-base font-semibold text-white">Create User</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { k: 'name', label: 'Full name', placeholder: 'Jane Smith' },
            { k: 'email', label: 'Email', placeholder: 'jane@example.com' },
            { k: 'organization', label: 'Organization', placeholder: 'Acme Corp' },
            { k: 'department', label: 'Department', placeholder: 'Security' },
            { k: 'jobFunction', label: 'Job function', placeholder: 'PSIRT Analyst' },
          ].map(({ k, label, placeholder }) => (
            <div key={k} className={k === 'email' ? 'col-span-2' : ''}>
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input value={(form as Record<string, unknown>)[k] as string}
                onChange={(e) => set(k, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">
              Temporary password <span className="text-gray-600">(min 12 chars, user should change on first login)</span>
            </label>
            <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        {roles.length > 0 && (
          <div>
            <label className="block text-xs text-gray-400 mb-2">Assign roles</label>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button key={r.roleId} type="button"
                  onClick={() => toggleRole(r.roleId)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    form.roleIds.includes(r.roleId)
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  {r.roleName}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={() => mutation.mutate()}
            disabled={!form.email || !form.name || form.password.length < 12 || mutation.isPending}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors">
            {mutation.isPending ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ResetPasswordFormProps {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

function ResetPasswordForm({ user, onClose, onSuccess }: ResetPasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post(`/users/${user.userId}/reset-password`, { newPassword }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-sm space-y-3">
        <h2 className="text-base font-semibold text-white">Reset Password</h2>
        <p className="text-xs text-gray-400">{user.name} · {user.email}</p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">New password (min 8 chars)</label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={() => mutation.mutate()}
            disabled={newPassword.length < 8 || mutation.isPending}
            className="bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors">
            {mutation.isPending ? 'Resetting…' : 'Reset password'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [filterStatus, setFilterStatus] = useState<UserStatus | 'all'>('all');

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const { data: roles } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });

  const filtered = users?.filter((u) =>
    filterStatus === 'all' ? true : u.status === filterStatus,
  ) ?? [];

  const counts = {
    active: users?.filter((u) => u.status === 'active').length ?? 0,
    suspended: users?.filter((u) => u.status === 'suspended').length ?? 0,
    disabled: users?.filter((u) => u.status === 'disabled').length ?? 0,
    pending: users?.filter((u) => u.status === 'pending').length ?? 0,
    noMfa: users?.filter((u) => u.status === 'active' && !u.mfaEnabled).length ?? 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {counts.active} active · {counts.suspended} suspended · {counts.disabled} disabled
            {counts.noMfa > 0 && (
              <span className="ml-2 text-yellow-400">· {counts.noMfa} active without MFA</span>
            )}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Create user
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1">
        {(['all', 'active', 'suspended', 'pending', 'disabled'] as const).map((s) => (
          <button key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors capitalize ${
              filterStatus === s
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}>
            {s === 'all' ? `All (${users?.length ?? 0})` : `${s} (${counts[s as keyof typeof counts] ?? 0})`}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-400">{String(error)}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Dept</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">MFA</th>
              <th className="text-left px-4 py-3 font-medium">Last login</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((u) => (
              <tr key={u.userId} className={`hover:bg-gray-800/50 transition-colors ${u.status === 'disabled' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{u.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                  {u.organization && (
                    <p className="text-xs text-gray-600">{u.organization}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{u.department ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLE[u.status]}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.mfaEnabled
                    ? <span title="MFA enabled"><CheckCircle className="w-4 h-4 text-green-400" /></span>
                    : <span title="MFA not enabled"><XCircle className="w-4 h-4 text-gray-600" /></span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {u.lastLoginAt ? format(new Date(u.lastLoginAt), 'dd MMM yyyy HH:mm') : 'Never'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {format(new Date(u.createdAt), 'dd MMM yyyy')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setResetTarget(u)}
                      title="Reset password"
                      className="p-1 text-gray-500 hover:text-yellow-400 transition-colors">
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    {u.status !== 'disabled' && (
                      <button
                        onClick={() => {
                          if (confirm(`Deactivate ${u.name}? This disables their account.`)) {
                            deactivateMutation.mutate(u.userId);
                          }
                        }}
                        title="Deactivate user"
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <Shield className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No users found.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Roles panel */}
      {roles && roles.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Roles</h2>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => (
              <div key={r.roleId} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-white">{r.roleName}</p>
                {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showInvite && (
        <InviteForm
          roles={roles ?? []}
          onClose={() => setShowInvite(false)}
          onSuccess={refresh}
        />
      )}
      {resetTarget && (
        <ResetPasswordForm
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
