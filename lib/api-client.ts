'use client';

const TOKEN_STORAGE_KEY = 'domouprav_session_token';

// In-memory fallback ensures auth works even in strict privacy modes where storage/cookies are restricted
let memoryToken: string | null = null;

export function setClientSessionToken(token: string | null): void {
  memoryToken = token;
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Storage may be blocked in restricted iframe contexts; memoryToken remains active
  }
}

export function getClientSessionToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

export function clearClientSessionToken(): void {
  setClientSessionToken(null);
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getClientSessionToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}
