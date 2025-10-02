<template>
    <div class="auth-buttons">
        <a :href="`${API_URL}/auth/google`" class="auth-btn social-btn google">
            <span style="padding-left: 10px">{{ $t('login_google') }}</span>
        </a>
        <a :href="`${API_URL}/auth/facebook`" class="auth-btn social-btn facebook">
            <span style="padding-left: 20px">{{ $t('login_facebook') }}</span>
        </a>
    </div>
</template>

<style scoped>
.auth-buttons {
    margin-top: 5px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: center;
    width: 100%;
    max-width: 325px;
}

/* buttons */
.auth-btn {
    flex: 1;
    width: 100%;
    padding: 10px 16px;
    font-size: 14px;
    text-align: center;
    border: 1px solid var(--auth-btn-border);
    border-radius: var(--auth-btn-radius);
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
    background: var(--auth-btn-bg);
    color: var(--auth-btn-text);
    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.auth-btn:hover {
    background: var(--auth-btn-hover-bg);
}

.auth-btn:focus {
    outline: none;
    border-color: var(--input-focus);
    /* from your input tokens */
}

/* social icons */
.social-btn.google,
.social-btn.facebook {
    background-repeat: no-repeat;
    background-position: 12px center;
    background-size: 20px;
}

/* Google keeps its multicolor logo */
.social-btn.google {
    background-image: url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNMTcuNiA5LjJsLS4xLTEuOEg5djMuNGg0LjhDMTMuNiAxMiAxMyAxMyAxMiAxMy42djIuMmgzYTguOCA4LjggMCAwIDAgMi42LTYuNnoiIGZpbGw9IiM0Mjg1RjQiIGZpbGwtcnVsZT0ibm9uemVybyIvPjxwYXRoIGQ9Ik05IDE4YzIuNCAwIDQuNS0uOCA2LTIuMmwtMy0yLjJhNS40IDUuNCAwIDAgMS04LTIuOUgxVjEzYTkgOSAwIDAgMCA4IDV6IiBmaWxsPSIjMzRBODUzIiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNNCAxMC43YTUuNCA1LjQgMCAwIDEgMC0zLjRWNUgxYTkgOSAwIDAgMCAwIDhsMy0yLjN6IiBmaWxsPSIjRkJCQzA1IiBmaWxsLXJ1bGU9Im5vbnplcm8iLz48cGF0aCBkPSJNOSAzLjZjMS4zIDAgMi41LjQgMy40IDEuM0wxNSAyLjNBOSA5IDAgMCAwIDEgNWwzIDIuNGE1LjQgNS40IDAgMCAxIDUtMy43eiIgZmlsbD0iI0VBNDMzNSIgZmlsbC1ydWxlPSJub256ZXJvIi8+PHBhdGggZD0iTTAgMGgxOHYxOEgweiIvPjwvZz48L3N2Zz4=);
}

/* Facebook brand icon */
.social-btn.facebook {
    background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZmlsbD0iIzMwNjVhOSIgZD0iTTI0IDEyYzAtNi42MjUtNS4zNzUtMTItMTItMTItNi42MjUgMC0xMiA1LjM3NS0xMiAxMiAwIDUuOTg0IDQuMzcgMTAuOTEyIDEwLjA5NCAxMS43NXYtOC4zMTVoLTIuNDcyVjEySDEyVjkuMzcyYzAtMi40NTYgMS40NjctMy44MzcgMy43MDYtMy44MzdjMS4wNzYgMCAyLjE5Mi4xOTUzIDIuMTkyLjE5NTN2Mi4zNThIMTYuNDk2Yy0xLjIzNiAwLTEuNjIxLjcwNS0xLjYyMSAxLjQzOXYxLjcwMkgxOC41bC0uNDE5IDMuNDg2aC0yLjAwNlYyNEMxOS42MyAyMy4xNTIgMjQgMTguMTc4IDI0IDEyeiIvPjwvc3ZnPg==');
}
</style>

<script setup>
const API_URL = import.meta.env.VITE_API_URL
</script>
