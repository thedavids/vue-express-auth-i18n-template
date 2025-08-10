<template>
    <div>
        <h2>{{ $t('email_verification') }}</h2>
        <p v-if="message">{{ message }}</p>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const message = ref('');

onMounted(async () => {
    const token = route.query.token;

    if (!token) {
        message.value = 'Invalid verification link.';
        return;
    }

    try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token })
        });

        if (res.status === 201) {
            const data = await res.json();
            message.value = data.message || 'Your email has been verified!';

            // redirect after a short delay
            setTimeout(() => router.push('/login'), 3000);
        }
        else {
            message.value = data.error || 'Verification failed.';
        }
    }
    catch (err) {
        message.value = 'An error occurred.';
        console.error(err);
    }
});
</script>
