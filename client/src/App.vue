<template>
    <div id="app">
        <NavBar />
        <main>
            <RouterView />
        </main>
    </div>
</template>

<style scoped>
main {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 15px;
    box-sizing: border-box;
    overflow: auto;
    align-items: center;
}
</style>

<script setup>
import NavBar from './components/nav/NavBar.vue';
</script>