import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { i18n } from './i18n';
import './style.css';

// Detect browser language
const savedLocale = localStorage.getItem('language');
const browserLang = navigator.language || navigator.userLanguage || 'en';

if (savedLocale) {
    i18n.global.locale.value = savedLocale;
}
else if (browserLang.startsWith('fr')) {
    i18n.global.locale.value = 'fr';
}
document.documentElement.setAttribute('lang', i18n.global.locale.value);

createApp(App)
    .use(router)
    .use(i18n)
    .mount('#app');

const refreshTokenUrl = `${import.meta.env.VITE_API_URL}/refresh-token`;
let isRefreshing = false;
let lastRefreshTime = 0; // in milliseconds
const REFRESH_INTERVAL = 12 * 60 * 1000; // 12 minutes

async function refreshAccessToken() {
    const now = Date.now();

    // If last refresh was recent, skip
    if (now - lastRefreshTime < REFRESH_INTERVAL) {
        return;
    }

    if (isRefreshing) {
        return;
    }

    isRefreshing = true;
    try {
        const res = await fetch(refreshTokenUrl, {
            method: 'POST',
            credentials: 'include'
        });

        if (!res.ok) {
            console.warn('Refresh token failed');
        }
        else {
            lastRefreshTime = Date.now();
        }
    }
    catch (err) {
        console.error('Failed to refresh access token:', err);
    }
    finally {
        isRefreshing = false;
    }
}

// Background interval
setInterval(refreshAccessToken, 4 * 60 * 1000); // check every 4 minutes

// On tab focus
window.addEventListener('focus', refreshAccessToken);
