<script setup>
import UserPanel from '../components/UserPanel.vue';
</script>

<style scoped>
h1 {
    font-size: 2.5rem;
    text-align: center;
}

p {
    font-size: 1.2rem;
    text-align: center;
}
</style>

<template>
    <h1>{{ $t('product_title') }}</h1>
    <p>{{ $t('product_description1') }}</p>
    <p>{{ $t('product_description2') }}</p>
    <UserPanel />
</template>
