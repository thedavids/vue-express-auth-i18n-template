<template>
    <div class="field form-textarea">
        <label v-if="label" :for="id">{{ label }}</label>

        <!-- Read-only: auto-sized viewer -->
        <div v-if="readonly" :id="id" class="textarea-static" :class="{ invalid }" aria-readonly="true">
            {{ modelValue }}
        </div>

        <!-- Edit mode: resizable textarea -->
        <textarea v-else :id="id" :value="modelValue" :rows="rows" :maxlength="maxLength" :placeholder="placeholder"
            :disabled="loading" :class="{ invalid }" :style="editStyle" @input="onInput" />

        <small v-if="error" class="error">{{ error }}</small>
        <small v-else-if="hint" class="hint">{{ hint }}</small>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    modelValue: { type: String, default: '' },
    readonly: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },

    placeholder: { type: String, default: '' },
    rows: { type: Number, default: 4 },
    maxLength: { type: Number, default: 8000 },

    label: { type: String, default: '' },
    id: { type: String, default: () => `ta-${Math.random().toString(36).slice(2)}` },

    invalid: { type: Boolean, default: false },
    hint: { type: String, default: '' },
    error: { type: String, default: '' },

    /** 'vertical' | 'both' | 'none' - edit-mode resize behavior */
    resizable: { type: String, default: 'vertical' }
});

const emit = defineEmits(['update:modelValue']);

function onInput(e) {
    emit('update:modelValue', e.target.value);
}

const editStyle = computed(() => {
    // In edit mode we want native resize; keep overflow auto for usability.
    const resize =
        props.resizable === 'both' ? 'both' :
            props.resizable === 'none' ? 'none' : 'vertical';
    return { resize, overflow: 'auto' };
});
</script>

<style scoped>
/* Read-only viewer styled like your inputs */
.textarea-static {
    min-height: 100px;
    padding: 10px 12px;
    border: 1px solid var(--input-border, #d1d5db);
    border-radius: 8px;
    background: var(--input-bg, #fff);
    color: var(--text, #133);
    white-space: pre-wrap;
    /* keep newlines */
    word-wrap: break-word;
}

/* Inherit your existing .field/.hint/.error styles from global CSS.
   If you use .invalid globally to force border color, this matches it: */
.textarea-static.invalid {
    border-color: #ef4444 !important;
}
</style>
