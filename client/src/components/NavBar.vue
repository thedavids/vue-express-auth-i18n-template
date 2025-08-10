<template>
    <nav class="navbar">
        <div class="logo">
            <RouterLink to="/" class="logo-icon">🏠</RouterLink>
        </div>

        <div class="nav-links">

            <template v-if="!user">
                <RouterLink to="/login" class="btn">{{ $t('login') }}</RouterLink>
                <RouterLink to="/signup" class="btn">{{ $t('signup') }}</RouterLink>
            </template>

            <template v-if="user">
                <div class="dropdown" ref="dropdownRef">
                    <button class="btn" @click="toggleMainDropdown()">
                        👤 {{ user.displayName }}
                    </button>

                    <div v-if="showDropdown" class="dropdown-menu">
                        <RouterLink to="/profile" class="dropdown-item">{{ $t('profile') }}</RouterLink>
                        <button @click="logout" class="dropdown-item dropdown-item-100">{{ $t('logout') }}</button>
                    </div>
                </div>
            </template>

            <div class="lang-dropdown" ref="langRef">
                <button class="btn icon" @click="toggleLangDropdown()">🌐</button>
                <div v-if="showLangDropdown" class="dropdown-menu">
                    <button @click="setLanguage('en')" class="dropdown-item dropdown-item-100">{{ $t('english')
                        }}</button>
                    <button @click="setLanguage('fr')" class="dropdown-item dropdown-item-100">{{ $t('french')
                        }}</button>
                </div>
            </div>
        </div>
    </nav>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const { user, clearUser } = useAuth();
const { locale } = useI18n();

const showDropdown = ref(false);
const dropdownRef = ref(null);
const showLangDropdown = ref(false);
const langRef = ref(null);

function handleClickOutside(e) {
    if (
        (dropdownRef.value && !dropdownRef.value.contains(e.target)) &&
        (langRef.value && !langRef.value.contains(e.target))
    ) {
        showDropdown.value = false;
        showLangDropdown.value = false;
    }
}

function toggleMainDropdown() {
    const next = !showDropdown.value;
    showDropdown.value = next;
    if (next) showLangDropdown.value = false;
}

function toggleLangDropdown() {
    const next = !showLangDropdown.value;
    showLangDropdown.value = next;
    if (next) showDropdown.value = false;
}

function onKey(e) {
    if (e.key === 'Escape') {
        showDropdown.value = false;
        showLangDropdown.value = false;
    }
}

onMounted(() => {
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('keydown', onKey);
});

function setLanguage(lang) {
    locale.value = lang;
    localStorage.setItem('language', lang);
    document.documentElement.setAttribute('lang', lang);
    showLangDropdown.value = false;
}

async function logout() {
    await fetch(`${import.meta.env.VITE_API_URL}/logout`, {
        method: 'POST',
        credentials: 'include'
    });

    clearUser();
    router.push('/login');
}
</script>

<style scoped>
.navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 5px;
    border-bottom: 1px solid #ddd;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
    position: sticky;
    top: 0;
    z-index: 1000;
    /* above page content & dropdowns */
    background: #fff;
    /* so content doesn’t show through */
}

.logo {
    font-size: 1.25rem;
    font-weight: bold;
}

.nav-links {
    display: flex;
    align-items: center;
    gap: 10px;
}

.btn {
    padding: 0.4rem 1rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    background-color: #f9f9f9;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    transition: background-color 0.2s ease;
}

.btn:hover {
    background-color: #eee;
}

.dropdown {
    position: relative;
}

.lang-dropdown {
    position: relative;
}

.dropdown-menu {
    position: absolute;
    right: 0;
    top: 110%;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    width: 160px;
    z-index: 10;
}

.dropdown-item,
.dropdown-item-100 {
    display: block;
    padding: 0.5rem 1rem;
    text-align: left;
    background: white;
    border: none;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
    font: inherit;
    /* Matches text style between button & link */
    line-height: normal;
    /* Prevents extra button height */
}

.dropdown-item:hover,
.dropdown-item-100:hover {
    background-color: #f3f3f3;
}

.dropdown-item-100 {
    width: 100%;
}
</style>
