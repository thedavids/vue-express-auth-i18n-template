<template>
    <div class="center-children">
        <div class="card width-380">
            <h2>{{ $t('password_reset') }}</h2>

            <form class="form" @submit.prevent="resetPassword">

                <input class="field" v-model="password" type="password" :placeholder="$t('password_new')"
                    maxlength="100" required />
                <input class="field" v-model="confirmPassword" type="password" :placeholder="$t('password_confirm')"
                    maxlength="100" required />

                <div class="actions left">
                    <button class="btn primary" type="submit">{{ $t('reset') }}</button>
                </div>
                <p v-if="message">{{ message }}</p>
            </form>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiFetch } from '../../utils/apiFetch';

const password = ref('');
const confirmPassword = ref('');
const message = ref('');
const route = useRoute();
const router = useRouter();
const token = route.query.token;
const API_URL = import.meta.env.VITE_API_URL;

async function resetPassword() {
    if (password.value !== confirmPassword.value) {
        message.value = "Passwords don't match.";
        return;
    }

    const res = await apiFetch(`/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password: password.value })
    });

    const data = await res.json();
    if (res.ok) {
        message.value = 'Password reset successful. Redirecting...';
        setTimeout(() => router.push('/login'), 2000);
    }
    else {
        message.value = data.error || 'Reset failed.';
    }
}
</script>
