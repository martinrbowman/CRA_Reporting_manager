import { api, setTokens, clearTokens } from './api.js';

export interface AuthUser {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function getCurrentUser(): AuthUser | null {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!)) as AuthUser & { exp: number };
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hasPermission(permission: string): boolean {
  const user = getCurrentUser();
  return user?.permissions.includes(permission) ?? false;
}

// Login precedence: GET /settings/auth-methods tells us whether AD/LDAP is
// configured. When it is, the same username/password the user typed is tried
// against /auth/ldap FIRST; on any failure (bad credentials, LDAP down, LDAP
// not actually enabled) we fall back to local /auth/token using the same
// input as the email. When LDAP isn't enabled we skip straight to local.
export async function login(usernameOrEmail: string, password: string): Promise<void> {
  let ldapEnabled = false;
  try {
    const methods = await api.get<{ ldapEnabled: boolean }>('/settings/auth-methods');
    ldapEnabled = methods.ldapEnabled;
  } catch {
    // If the check itself fails, fall through to local login.
  }

  if (ldapEnabled) {
    try {
      const data = await api.post<TokenResponse>('/auth/ldap', {
        username: usernameOrEmail,
        password,
      });
      setTokens(data.accessToken, data.refreshToken);
      return;
    } catch {
      // Fall back to local login below.
    }
  }

  const data = await api.post<TokenResponse>('/auth/token', {
    email: usernameOrEmail,
    password,
  });
  setTokens(data.accessToken, data.refreshToken);
}

export function logout(): void {
  clearTokens();
  window.location.href = '/login';
}
