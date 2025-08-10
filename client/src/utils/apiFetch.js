// utils/apiFetch.js
import { router } from '../router';

export async function apiFetch(url, options = {}) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}${url}`, {
        credentials: 'include',
        ...options
    });

    if (res.status === 401) {
        console.warn('Received 401 — redirecting to login');
        router.push('/');
        throw new Error('Unauthorized');
    }

    return res;
}