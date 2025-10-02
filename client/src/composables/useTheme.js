import { ref } from 'vue';

const theme = ref(localStorage.getItem('theme') || 'light');

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
    localStorage.setItem('theme', t);
    theme.value = t;
}

function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark');
}

export function useTheme() {
    return { theme, applyTheme, toggleTheme };
}