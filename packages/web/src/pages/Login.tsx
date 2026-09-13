import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { login } from '../lib/auth.js';
import { setTokens, api } from '../lib/api.js';

// Only two OAuth providers exist in this fork: Microsoft Entra ID and a
// generic OIDC escape hatch. No google/github keys.
interface OauthProviders { microsoft: boolean; oidc: boolean; }

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OauthProviders | null>(null);

  // Handle OAuth callback via hash fragment: #/oauth-callback?accessToken=...
  useEffect(() => {
    if (location.hash.includes('oauth-callback')) {
      const params = new URLSearchParams(location.hash.replace('#/oauth-callback?', ''));
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');
      const oauthError = params.get('oauth_error');
      if (accessToken) {
        setTokens(accessToken, refreshToken ?? '');
        navigate('/dashboard', { replace: true });
      } else if (oauthError) {
        setError(`Sign-in failed: ${oauthError}`);
      }
    }
    const searchParams = new URLSearchParams(location.search);
    const oauthError = searchParams.get('oauth_error');
    if (oauthError) setError(`Sign-in failed: ${oauthError}`);
  }, [location, navigate]);

  // Load enabled OAuth providers for the "or continue with" buttons.
  useEffect(() => {
    api.get<OauthProviders>('/settings/oauth/providers')
      .then(setOauthProviders)
      .catch(() => {});
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // The single username field doubles as the LDAP username and the local
      // email — login() tries LDAP first (if enabled) then falls back to
      // local, sending this same value to both.
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <ShieldAlert className="w-10 h-10 text-blue-400 mb-3" />
          <h1 className="text-xl font-semibold text-white">CRA Compliance Platform</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Username or email</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-md transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {oauthProviders && (oauthProviders.microsoft || oauthProviders.oidc) && (
          <>
            <div className="flex items-center gap-3 mt-6">
              <div className="flex-1 border-t border-gray-800" />
              <span className="text-xs text-gray-600">or continue with</span>
              <div className="flex-1 border-t border-gray-800" />
            </div>
            <div className="mt-3 space-y-2">
              {oauthProviders.microsoft && (
                <a href="/api/v1/oauth/microsoft"
                  className="flex items-center justify-center gap-2 w-full border border-gray-700 rounded-md py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 21 21"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>
                  Sign in with Microsoft Entra ID
                </a>
              )}
              {oauthProviders.oidc && (
                <a href="/api/v1/oauth/oidc"
                  className="flex items-center justify-center gap-2 w-full border border-gray-700 rounded-md py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                  <ShieldAlert className="w-4 h-4" />
                  Single Sign-On
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
