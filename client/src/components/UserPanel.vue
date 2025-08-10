<template>
    <div v-if="user">
    </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuth } from '../composables/useAuth';
const API_URL = import.meta.env.VITE_API_URL;

const { user, setUser } = useAuth();

async function fetchUser() {
    const res = await fetch(`${API_URL}/me`, { credentials: 'include' });
    if (res.ok) {
        const data = await res.json();
        setUser(data.user);
    }
}

onMounted(fetchUser);
</script>
