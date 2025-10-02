<template>
    <div class="dropdown">
        <button class="btn icon" @click="onToggle" ref="btnRef" aria-haspopup="menu"
            :aria-expanded="open ? 'true' : 'false'" aria-label="Settings" title="Settings">⚙️</button>

        <!-- Teleport the panel to <body> -->
        <Teleport to="body">
            <div v-if="open" class="dropdown-menu nav-portal-menu" :style="menuStyle" role="menu">
                <button class="dropdown-item dropdown-item-100" @click="() => setLang('en')" role="menuitem">
                    {{ $t('english') }}
                </button>
                <button class="dropdown-item dropdown-item-100" @click="() => setLang('fr')" role="menuitem">
                    {{ $t('french') }}
                </button>

                <hr />

                <button class="dropdown-item dropdown-item-100" @click="() => { toggleTheme(); close(); }"
                    :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" role="menuitem">
                    {{ theme === 'dark' ? '☀️' : '🌙' }}
                </button>
            </div>
        </Teleport>
    </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { setLanguage } from '../../utils/dateTime';
import { useTheme } from '../../composables/useTheme';
import { useAnchoredMenu } from '../../composables/useAnchoredMenu';

const { locale } = useI18n();
const { theme, applyTheme, toggleTheme } = useTheme();

// Reuse shared anchored-menu logic
const { open, btnRef, menuStyle, makeToggle, close } = useAnchoredMenu({
    who: 'SettingsMenu',
    panelWidth: 280,     // a bit wider for long labels
});

// No async work needed on open right now, but the hook stays consistent
const onToggle = makeToggle();

function setLang(lang) {
    locale.value = lang;
    setLanguage(locale.value);
    close();
}

onMounted(() => {
    applyTheme(theme.value);
});
</script>
