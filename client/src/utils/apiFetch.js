// utils/apiFetch.js
import { router } from '../router';

const API_URL = import.meta.env.VITE_API_URL;

// --- CSRF helpers (cached token) ---
let _csrfToken = null;
let _csrfFetchPromise = null;

async function fetchCsrfToken() {
    if (_csrfToken) return _csrfToken;
    if (_csrfFetchPromise) return _csrfFetchPromise;

    _csrfFetchPromise = fetch(`${API_URL}/api/csrf-token`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`CSRF ${r.status}`))))
        .then((d) => {
            _csrfToken = d?.csrfToken || null;
            return _csrfToken;
        })
        .finally(() => {
            _csrfFetchPromise = null;
        });

    return _csrfFetchPromise;
}

export function invalidateCsrfToken() {
    _csrfToken = null;
}

function needsCsrf(method) {
    const m = (method || 'GET').toUpperCase();
    return m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS';
}

// Helper: does current route require auth?
function routeRequiresAuth() {
    try {
        const cur = router.currentRoute.value;
        return !!(cur && cur.meta && cur.meta.requiresAuth);
    } catch {
        return false;
    }
}

/**
 * apiFetch(path, {
 *   method, headers, body, // same as fetch
 *   redirectOn401?: boolean, // override redirect behavior
 * })
 */
export async function apiFetch(path, options = {}) {
    const url = `${API_URL}${path}`;
    const method = (options.method || 'GET').toUpperCase();

    // Decide redirect behavior:
    // - If caller provides redirectOn401, use it.
    // - Otherwise, redirect only when the current route requires auth.
    const shouldRedirectOn401 =
        typeof options.redirectOn401 === 'boolean' ? options.redirectOn401 : routeRequiresAuth();

    // Build headers
    const headers = new Headers(options.headers || {});
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');

    // Don’t set Content-Type for FormData
    const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (options.body && !isForm && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    // Attach CSRF token for state-changing requests
    if (needsCsrf(method)) {
        try {
            const token = await fetchCsrfToken();
            if (token) headers.set('X-CSRF-Token', token);
        } catch {
            // If CSRF fetch fails, server may 403; we'll retry once below
        }
    }

    const doFetch = (hdrs) =>
        fetch(url, { ...options, credentials: 'include', method, headers: hdrs });

    let res = await doFetch(headers);

    // Handle 401 (unauthorized)
    if (res.status === 401) {
        if (path === '/login') {
            return res;
        }

        // If page requires auth (or caller asked), redirect to login (avoid loops)
        if (shouldRedirectOn401 && router.currentRoute.value?.path !== '/login') {
            console.warn('Received 401 - redirecting to login');
            router.push('/login');
        }
        throw new Error('Unauthorized');
    }

    // Retry once on CSRF failure
    if (res.status === 403 && needsCsrf(method)) {
        invalidateCsrfToken();
        const fresh = await fetchCsrfToken().catch(() => null);
        if (fresh) {
            headers.set('X-CSRF-Token', fresh);
            res = await doFetch(headers);
        }
    }

    return res;
}
