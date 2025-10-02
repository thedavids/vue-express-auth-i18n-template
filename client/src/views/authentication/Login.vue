<template>
    <div class="center-children">
        <div class="card width-380">
            <h2>{{ $t('login') }}</h2>

            <form class="form" @submit.prevent="login">

                <input class="field" v-model="email" type="email" :placeholder="$t('email')" autocomplete="email"
                    maxlength="254" required />

                <input class="field" v-model="password" type="password" :placeholder="$t('password')"
                    autocomplete="password" maxlength="100" required />

                <div class="actions left">
                    <button class="btn primary" type="submit">{{ $t('login') }}</button>
                </div>

                <p class="forgot-password">
                    <router-link to="/forgot-password">{{ $t('forgot_password') }}</router-link>
                </p>
            </form>
        </div>
    </div>

    <AuthButtons />
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthButtons from '../../components/AuthButtons.vue';
import { apiFetch } from '../../utils/apiFetch';

const API_URL = import.meta.env.VITE_API_URL;
const email = ref('');
const password = ref('');
const router = useRouter();

async function login() {
    const res = await apiFetch(`/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.value, password: password.value })
    });

    if (res.ok) {
        router.push('/');
    }
    else {
        const data = await res.json();
        alert(data.error || 'Login failed');
    }
}
</script>
