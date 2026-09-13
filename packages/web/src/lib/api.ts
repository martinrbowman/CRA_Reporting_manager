const BASE = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem('accessToken', access);
  if (refresh) localStorage.setItem('refreshToken', refresh);
}

export function clearTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json() as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> ?? {}),
  };

  let res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE}${path}`, { ...init, headers });
    } else {
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = getToken();
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  },

  // Fetches a binary response (e.g. a generated PDF) with the bearer token
  // attached — used by CRA report PDF export, which can't be a plain <a href>
  // since it needs Authorization. Mirrors `request`'s 401-retry-once behavior.
  getBlob: async (path: string): Promise<Blob> => {
    const token = getToken();
    let res = await fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${newToken}` } });
      } else {
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.blob();
  },
};

// Triggers a browser download of a blob without ever exposing a downloadable
// URL that bypasses auth — used after api.getBlob() resolves.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
