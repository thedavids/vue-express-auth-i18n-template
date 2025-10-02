<template>
    <nav class="navbar">
        <div class="logo">
            <RouterLink to="/">
                <img src="/logo.jpg" alt="Logo" class="logo-img logo-img-size" />
            </RouterLink>

        </div>

        <div class="nav-links">
            <template v-if="!user">
                <RouterLink to="/login" class="btn">{{ $t('login') }}</RouterLink>
                <RouterLink to="/signup" class="btn">{{ $t('signup') }}</RouterLink>
            </template>

            <template v-else>
                <UserMenu />
            </template>

            <SettingsMenu />
        </div>
    </nav>
</template>

<script setup>
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import { apiFetch } from '../../utils/apiFetch';
import UserMenu from './UserMenu.vue';
import SettingsMenu from './SettingsMenu.vue';

const { user, setUser } = useAuth();
const router = useRouter();

async function fetchUser() {
    try {
        const res = await apiFetch(`/me`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            setUser(data.user);
        }
    }
    catch (e) {
        // ignore
    }
}

onMounted(fetchUser);

watch(
    () => router.currentRoute.value.fullPath,
    async () => {
        if (!user.value) {
            await fetchUser();
        }
    },
    { immediate: false }
);
</script>

<style scoped>
.logo-img {
    width: auto;
    border-radius: 5px;
}

.logo-img-size {
    height: 50px;
}

/* small phones */
@media (max-width: 420px) {
    .logo-img-size {
        height: 28px;
        margin-top: 5px;
        margin-right: 8px;
    }
}
</style>