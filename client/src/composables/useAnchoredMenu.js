// src/composables/useAnchoredMenu.js
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue';

export function useAnchoredMenu(opts) {
    const {
        who,
        panelWidth = 240,
        gap = 6,
        margin = 8,
        zIndex = 2000,
    } = opts || {};

    const open = ref(false);
    const btnRef = ref(null);

    const menuStyle = ref({
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: `${panelWidth}px`,
        zIndex: String(zIndex),
    });

    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }

    function updateMenuPosition() {
        const btn = btnRef.value;
        if (!btn) return;

        const rect = btn.getBoundingClientRect();

        let left = rect.right - panelWidth;
        left = clamp(left, margin, window.innerWidth - panelWidth - margin);

        let top = rect.bottom + gap;
        if (top > window.innerHeight) {
            top = Math.max(rect.top - gap, margin);
        }

        menuStyle.value = {
            ...menuStyle.value,
            top: `${top}px`,
            left: `${left}px`,
            width: `${panelWidth}px`,
            position: 'fixed',
            zIndex: String(zIndex),
        };
    }

    function close() {
        open.value = false;
    }

    function onDocClick(e) {
        const portal = document.querySelector('.nav-portal-menu');
        if (
            btnRef.value &&
            !btnRef.value.contains(e.target) &&
            portal &&
            !portal.contains(e.target)
        ) {
            close();
        }
    }

    function onKey(e) {
        if (e.key === 'Escape') close();
    }

    function onNavOpened(e) {
        if (e.detail && e.detail.who !== who) close();
    }

    // Factory: returns an onToggle handler
    function makeToggle(onWillOpen) {
        return async function onToggle() {
            const willOpen = !open.value;
            if (willOpen) {
                window.dispatchEvent(new CustomEvent('nav-opened', { detail: { who } }));
                if (onWillOpen) await onWillOpen();
            }
            open.value = willOpen;

            if (open.value) {
                await nextTick();
                updateMenuPosition();
            }
        };
    }

    onMounted(() => {
        window.addEventListener('click', onDocClick, true);
        window.addEventListener('keydown', onKey);
        window.addEventListener('nav-opened', onNavOpened);
    });

    onBeforeUnmount(() => {
        close();
        window.removeEventListener('click', onDocClick, true);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('nav-opened', onNavOpened);
    });

    return {
        open,
        btnRef,
        menuStyle,
        updateMenuPosition,
        makeToggle,
        close,
    };
}
