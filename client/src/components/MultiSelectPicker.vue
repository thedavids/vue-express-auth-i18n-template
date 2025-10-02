<!-- File: components/ui/MultiSelectPicker.vue -->
<template>
    <div class="picker" ref="pickerRef">
        <button type="button" class="picker-button" :aria-expanded="open ? 'true' : 'false'" :disabled="disabled"
            @click="toggleOpen">
            <span v-if="modelValue.length">{{ selectedCountTextFormatted }}</span>
            <span v-else>{{ placeholder }}</span>
        </button>

        <!-- Popover teleported to body -->
        <Teleport to="body">
            <div v-if="open" ref="menuRef" class="picker-popover" role="dialog" aria-label="Multi select picker"
                :style="menuStyle" @mousedown.stop>
                <input type="text" v-model.trim="q" :placeholder="searchPlaceholder" class="input picker-search"
                    :disabled="disabled" @keydown.escape.prevent.stop="close" autofocus />

                <div class="picker-list" role="listbox" aria-multiselectable="true">
                    <label v-for="item in filtered" :key="item.id" class="picker-item">
                        <input type="checkbox" :value="item.id" :checked="isSelected(item.id)"
                            @change="toggle(item.id)" />
                        <span class="name">{{ item[labelKey] }}</span>
                    </label>
                    <p v-if="!filtered.length && items.length" class="hint">{{ noResultsText }}</p>
                </div>

                <div class="row-inline menu-actions">
                    <button type="button" class="btn secondary" @click="selectAllFiltered" :disabled="!filtered.length">
                        {{ selectAllLabel }}
                    </button>
                    <button type="button" class="btn secondary" @click="clearAll" :disabled="!modelValue.length">
                        {{ clearAllLabel }}
                    </button>
                    <button type="button" class="btn secondary" @click="close">{{ closeLabel }}</button>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue';

const props = defineProps({
    modelValue: { type: Array, default: () => [] },            // array of selected ids
    items: { type: Array, default: () => [] },                  // [{ id, name, slug? }, ...]
    labelKey: { type: String, default: 'name' },
    searchKeys: { type: Array, default: () => ['name', 'slug'] },
    disabled: { type: Boolean, default: false },

    // i18n texts provided by parent
    placeholder: { type: String, default: 'Select…' },
    selectedCountText: { type: String, default: 'Selected: {n}' },
    searchPlaceholder: { type: String, default: 'Search' },
    selectAllLabel: { type: String, default: 'Select all (filtered)' },
    clearAllLabel: { type: String, default: 'Clear all' },
    closeLabel: { type: String, default: 'Close' },
    noResultsText: { type: String, default: 'No results' },
});

const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const q = ref('');
const pickerRef = ref(null);
const menuRef = ref(null);
const menuStyle = ref({}); // fixed-position coords + size

const filtered = computed(() => {
    const term = q.value.trim().toLowerCase();
    if (!term) return props.items;
    return props.items.filter((it) =>
        props.searchKeys.some((k) => String(it?.[k] ?? '').toLowerCase().includes(term))
    );
});

const selectedSet = computed(() => new Set(props.modelValue));
const selectedCountTextFormatted = computed(() =>
    props.selectedCountText.replace('{n}', String(props.modelValue.length))
);

function isSelected(id) {
    return selectedSet.value.has(id);
}
function toggle(id) {
    const set = new Set(selectedSet.value);
    set.has(id) ? set.delete(id) : set.add(id);
    emit('update:modelValue', Array.from(set));
}
function selectAllFiltered() {
    const set = new Set(selectedSet.value);
    for (const it of filtered.value) set.add(it.id);
    emit('update:modelValue', Array.from(set));
}
function clearAll() {
    emit('update:modelValue', []);
}

function toggleOpen() {
    if (props.disabled) return;
    open.value = !open.value;
    if (open.value) {
        nextTick(() => {
            positionMenu();
            focusSearch();
        });
        addGlobalListeners();
    } else {
        removeGlobalListeners();
    }
}
function close() {
    open.value = false;
    removeGlobalListeners();
}

function onDocClick(e) {
    const root = pickerRef.value;
    const menu = menuRef.value;
    if (!root) return;

    const insideRoot = root.contains(e.target);
    const insideMenu = menu && menu.contains(e.target);
    if (open.value && !(insideRoot || insideMenu)) close();
}

function focusSearch() {
    const el = menuRef.value?.querySelector('input[type="text"]');
    if (el) el.focus();
}

function positionMenu() {
    const trigger = pickerRef.value?.querySelector('.picker-button');
    const menuEl = menuRef.value;
    if (!trigger || !menuEl) return;

    const r = trigger.getBoundingClientRect();
    const margin = 20;
    const DEFAULT_WIDTH = 400;

    // Width: respect trigger width, but keep inside the viewport (min 0, max vw - margins)
    const maxWidth = Math.min(DEFAULT_WIDTH, window.innerWidth - margin * 2);
    const width = Math.min(Math.max(r.width, DEFAULT_WIDTH), Math.max(160, maxWidth)); // allow <DEFAULT_WIDTH on tiny phones

    // Default: below trigger
    let left = r.left;
    let top = r.bottom + 6;

    // Clamp horizontally so it stays fully visible
    left = Math.min(Math.max(margin, left), window.innerWidth - width - margin);

    // Set style (use fixed positioning)
    menuStyle.value = {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        maxWidth: 'calc(100vw - 16px)',
        zIndex: 9999,
    };

    // Flip upwards if it overflows the bottom
    const h = menuEl.getBoundingClientRect().height;
    if (top + h + margin > window.innerHeight) {
        const flippedTop = Math.max(margin, r.top - h - 6);
        menuStyle.value.top = `${flippedTop}px`;
    }
}

function addGlobalListeners() {
    window.addEventListener('scroll', positionMenu, true); // capture to react to inner scroll containers
    window.addEventListener('resize', positionMenu);
    window.addEventListener('orientationchange', positionMenu);
    document.addEventListener('click', onDocClick, true);
}
function removeGlobalListeners() {
    window.removeEventListener('scroll', positionMenu, true);
    window.removeEventListener('resize', positionMenu);
    window.removeEventListener('orientationchange', positionMenu);
    document.removeEventListener('click', onDocClick, true);
}

onBeforeUnmount(removeGlobalListeners);
</script>

<style scoped>
/* Theme-aware via your design tokens */
.picker {
    position: relative;
}

.picker-button {
    padding: 11.35px 10px;
    min-width: 220px;
    text-align: left;
    border: 1px solid var(--input-border);
    border-radius: 10px;
    background: var(--input-bg);
    color: var(--text);
    transition: background-color .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease;
}

.picker-button:hover {
    background: var(--dropdown-hover-bg);
    border-color: var(--dropdown-border);
}

.picker-button:focus-visible {
    outline: 2px solid var(--input-focus);
    outline-offset: 2px;
}

/* Portal popover uses fixed positioning; size/pos from inline style */
.picker-popover {
    position: fixed;
    background: var(--dropdown-bg);
    border: 1px solid var(--dropdown-border);
    border-radius: 12px;
    box-shadow: var(--dropdown-shadow);
    padding: 10px;
    color: var(--text);
    max-width: calc(100vw - 16px);
}

.picker-search {
    margin-bottom: 8px;
    background: var(--input-bg);
    color: var(--text);
    border: 1px solid var(--input-border);
}

.picker-search:focus {
    border-color: var(--input-focus);
}

.picker-search::placeholder {
    color: var(--hint);
}

.picker-list {
    max-height: 260px;
    overflow: auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    padding-right: 4px;
}

.picker-item {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid var(--card-border);
    border-radius: 8px;
    background: var(--card-bg);
    color: var(--text);
    transition: background-color .15s ease, border-color .15s ease;
}

.picker-item:hover {
    background: var(--dropdown-hover-bg);
    border-color: var(--dropdown-border);
}

.picker-item .name {
    font-weight: 600;
}

.picker-item input[type="checkbox"] {
    accent-color: var(--input-focus);
}

.menu-actions {
    justify-content: flex-end;
    gap: 6px;
    margin-top: 8px;
}

@media (max-width: 640px) {

    /* width is managed inline, but allow full width feel on small screens */
    .picker-popover {
        max-width: 95vw;
    }
}
</style>
