export function formatDateTime(iso) {
    if (!iso) return '-';
    try {
        return new Date(iso).toLocaleString();
    }
    catch {
        return iso;
    }
}

export function formatDistance(meters) {
    if (meters == null) {
        return '';
    }
    return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
}

export function setLanguage(value) {
    localStorage.setItem('language', value);
    document.documentElement.setAttribute('lang', value);
    const cl = document.querySelector('meta[http-equiv="Content-Language"]');
    if (cl) {
        cl.setAttribute('content', value);
    }
    document.title = value === 'fr' ?
        'Je veux aider - Trouver ou proposer de l\'aide à proximité' :
        'I Want to Help - Find or Offer Help Nearby';
}

function nextPeriodResetUTC() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
}