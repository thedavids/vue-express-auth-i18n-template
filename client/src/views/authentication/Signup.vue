<template>

    <div class="center-children">
        <div class="card width-380">
            <h2>{{ $t('signup') }}</h2>

            <form class="form" @submit.prevent="register">

                <input class="field" v-model="email" type="email" :placeholder="$t('email')" autocomplete="email" maxlength="254" required />

                <input class="field" v-model="displayName" type="text" :placeholder="$t('display_name')" autocomplete="display-name" maxlength="254" required />

                <input class="field" v-model="password" type="password" autocomplete="password" :placeholder="$t('password')" maxlength="100"
                    required />

                <input class="field" v-model="confirmPassword" type="password"  autocomplete="confirm-password" :placeholder="$t('password_confirm')"
                    maxlength="100" required />

                <div class="actions left">
                    <button class="btn primary" type="submit" :disabled="loading">
                        {{ loading ? $t('registering') : $t('register') }}
                    </button>
                </div>

            </form>
        </div>
    </div>
    <AuthButtons />
</template>

<style></style>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AuthButtons from '../../components/AuthButtons.vue';
import { apiFetch } from '../../utils/apiFetch';

const email = ref('');
const displayName = ref('');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const router = useRouter();

async function register() {
    if (password.value !== confirmPassword.value) {
        alert("Passwords do not match");
        return;
    }

    loading.value = true;
    try {
        const res = await apiFetch(`/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                email: email.value,
                displayName: displayName.value,
                password: password.value
            })
        });

        if (res.status === 201) {
            const data = await res.json();
            alert(data.message || 'Registration successful! Please check your email to verify your account.');
            router.push('/');
        }
        else {
            const error = await res.json();
            alert(error.error || 'Registration failed');
        }
    }
    catch (err) {
        console.log(err);
        alert('Registration failed');
    }
    finally {
        loading.value = false;
    }
}
</script>
