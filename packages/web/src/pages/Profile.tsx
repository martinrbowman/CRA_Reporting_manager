import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../lib/api.js';
import { getCurrentUser } from '../lib/auth.js';

interface MeResponse {
  userId: string;
  email: string;
  name: string | null;
  organization: string | null;
  department: string | null;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
}

export default function ProfilePage() {
  const jwt = getCurrentUser();

  const { data: me, isLoading } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get('/me'),
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccess, setPwSuccess]             = useState(false);
  const [pwError, setPwError]                 = useState('');

  const changePassword = useMutation({
    mutationFn: () => api.post('/me/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      setPwSuccess(true);
      setPwError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: Error) => {
      setPwError(err.message);
      setPwSuccess(false);
    },
  });

  const pwValid =
    currentPassword.length > 0 &&
    newPassword.length >= 12 &&
    newPassword === confirmPassword;

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your account details</p>
      </div>

      {/* Account info */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Email</p>
            <p className="text-gray-200">{me?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Name</p>
            <p className="text-gray-200">{me?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Organization</p>
            <p className="text-gray-200">{me?.organization ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Department</p>
            <p className="text-gray-200">{me?.department ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Status</p>
            <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
              me?.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
            }`}>
              {me?.status ?? '—'}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Last login</p>
            <p className="text-gray-200 text-xs font-mono">
              {me?.lastLoginAt ? format(new Date(me.lastLoginAt), 'dd MMM yyyy HH:mm') : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Roles & permissions */}
      {jwt && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Roles & permissions</h2>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {jwt.roles.length > 0 ? jwt.roles.map((r) => (
                  <span key={r} className="text-xs px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded capitalize">
                    {r}
                  </span>
                )) : <span className="text-xs text-gray-500">No roles assigned</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Permissions ({jwt.permissions.length})</p>
              <div className="flex flex-wrap gap-1">
                {jwt.permissions.map((p) => (
                  <span key={p} className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded font-mono">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change password */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Change password</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setPwSuccess(false); setPwError(''); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600"
              placeholder="Current password"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPwSuccess(false); setPwError(''); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600"
              placeholder="Min. 12 characters"
            />
            {newPassword.length > 0 && newPassword.length < 12 && (
              <p className="text-xs text-yellow-500 mt-1">{12 - newPassword.length} more characters needed</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPwSuccess(false); setPwError(''); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-600"
              placeholder="Repeat new password"
            />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
            )}
          </div>
        </div>

        {pwError && <p className="text-xs text-red-400">{pwError}</p>}
        {pwSuccess && <p className="text-xs text-green-400">Password changed successfully.</p>}

        <button
          onClick={() => changePassword.mutate()}
          disabled={!pwValid || changePassword.isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors">
          {changePassword.isPending ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </div>
  );
}
