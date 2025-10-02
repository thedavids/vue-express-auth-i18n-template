<template>
    <div class="dropdown">
        <button v-if="user?.avatarUrl" class="btn btn-avatar" @click="onToggle" ref="btnRef" aria-haspopup="menu"
            :aria-expanded="open ? 'true' : 'false'">
            <img :src="user.avatarUrl" class="avatar-img-small" alt="Avatar" referrerpolicy="no-referrer" />
        </button>

        <button v-else class="btn icon" @click="onToggle" ref="btnRef" aria-haspopup="menu"
            :aria-expanded="open ? 'true' : 'false'">
            <span>👤</span>
        </button>

        <!-- Teleport the panel to <body> -->
        <Teleport to="body">
            <div v-if="open" class="dropdown-menu nav-portal-menu" :style="menuStyle" role="menu">
                <RouterLink to="/profile" class="dropdown-item" @click="close" role="menuitem">
                    {{ $t('profile') }}
                </RouterLink>

                <button class="dropdown-item dropdown-item-100" @click="onLogout" role="menuitem">
                    {{ $t('logout') }}
                </button>
            </div>
        </Teleport>
    </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import { apiFetch } from '../../utils/apiFetch';
import { useAnchoredMenu } from '../../composables/useAnchoredMenu';

const { user, clearUser } = useAuth();
const router = useRouter();

// Reuse the shared anchored menu (same pattern as Conversations/Notifications)
const { open, btnRef, menuStyle, makeToggle, close } = useAnchoredMenu({
    who: 'UserMenu',
    panelWidth: 220,     // a bit narrower for account actions
});

const onToggle = makeToggle(() => {
    // nothing async required here, but this is where you'd fetch user menu data if needed
});

async function onLogout() {
    await apiFetch(`/logout`, { method: 'POST', credentials: 'include' });
    clearUser();
    close();
    router.push('/login');
}

// Optional: if you want to run anything on mount/unmount (not required for the composable)
onMounted(() => { });
onBeforeUnmount(() => { });
</script>

<style scoped>
/* keep your existing avatar sizing */
.avatar-img-small {
    width: 20px;
    height: 20px;
    padding: 2px 0;
    vertical-align: middle;
}
</style>
