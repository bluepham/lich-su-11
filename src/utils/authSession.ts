const SESSION_STORAGE_KEY = 'ls11_session_token';

export function getStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token && token.trim()) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, token.trim());
    }
  } catch {
    // Ignore storage quota / privacy mode restrictions; cookie fallback remains active
  }
}

export function clearStoredSessionToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function buildApiAuthHeaders(
  existingHeaders?: HeadersInit,
  sessionToken?: string | null,
): Headers {
  const headers = new Headers(existingHeaders);
  const cleanToken = sessionToken?.trim();
  if (cleanToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${cleanToken}`);
  }
  return headers;
}

/**
 * Wrapper around the browser's read-only `window.fetch` getter.
 * Never mutates `window.fetch` (which is a getter-only property in iframe sandboxes)
 * while attaching both `credentials: 'include'` and `Authorization: Bearer <token>`
 * for cross-origin iframe session persistence.
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getStoredSessionToken();
  const baseHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  const headers = token ? buildApiAuthHeaders(baseHeaders, token) : baseHeaders;

  const nextInit: RequestInit = {
    ...init,
    credentials: init?.credentials ?? 'include',
  };
  if (headers !== undefined) {
    nextInit.headers = headers;
  }

  return window.fetch(input, nextInit);
}

export async function downloadAuthenticatedFile(
  url: string,
  fallbackFilename: string,
): Promise<boolean> {
  try {
    const res = await apiFetch(url);
    if (!res.ok) return false;
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1]?.trim() || fallbackFilename;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    return true;
  } catch {
    return false;
  }
}
