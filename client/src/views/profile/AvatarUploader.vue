<template>
    <div class="field">
        <label>{{ $t('avatar') }}</label>
        <div class="avatar-row">
            <img v-if="url" :src="cacheBustedUrl" class="avatar-img" alt="Avatar" referrerpolicy="no-referrer" />
            <div v-else class="avatar-placeholder">👤</div>

            <div class="avatar-actions">
                <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" @change="onSelected"
                    hidden />
                <div class="row-inline">
                    <button type="button" class="btn secondary" @click="fileInput?.click()" :disabled="busy">
                        <span v-if="!uploading">{{ $t('upload_new') }}</span>
                        <span v-else>{{ $t('uploading') }}</span>
                    </button>
                    <button v-if="url" type="button" class="btn secondary" @click="onRemove" :disabled="busy">
                        <span v-if="!deleting">{{ $t('remove_avatar') }}</span>
                        <span v-else>{{ $t('removing') }}</span>
                    </button>
                </div>
                <small v-if="error" class="error">{{ error }}</small>
                <small v-else class="hint">{{ $t('avatar_hint') }}</small>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiFetch } from '../../utils/apiFetch';
const { t } = useI18n();

const API_URL = import.meta.env.VITE_API_URL;

const props = defineProps({ initialUrl: { type: String, default: null } });
const emit = defineEmits(['updated', 'error']);

const url = ref(props.initialUrl);
watch(() => props.initialUrl, (v) => url.value = v);

const cacheBuster = ref(Date.now());
const fileInput = ref(null);
const uploading = ref(false);
const deleting = ref(false);
const error = ref('');
const busy = computed(() => uploading.value || deleting.value);
const cacheBustedUrl = computed(() => {
    if (!url.value) return null;
    const sep = url.value.includes('?') ? '&' : '?';
    return url.value + sep + 'v=' + (cacheBuster.value || Date.now());
});

async function onSelected(e) {
    error.value = '';
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { error.value = t('avatar_type_error'); e.target.value = ''; return; }
    if (file.size > 2 * 1024 * 1024) { error.value = t('avatar_size_error'); e.target.value = ''; return; }

    uploading.value = true;
    try {
        const fd = new FormData(); fd.append('avatar', file);
        const res = await apiFetch(`/api/profile/avatar`, { method: 'POST', credentials: 'include', body: fd });
        if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data?.error || `Upload failed (${res.status})`); }
        const data = await res.json().catch(() => ({}));
        if (data?.avatarUrl) { url.value = data.avatarUrl; cacheBuster.value = Date.now(); emit('updated', url.value); }
        else throw new Error('Invalid server response.');
    } catch (err) {
        console.error(err); error.value = err?.message || 'Failed to upload avatar.'; emit('error', error.value);
    } finally { uploading.value = false; if (e?.target) e.target.value = ''; }
}

async function onRemove() {
    if (deleting.value) return; error.value = ''; deleting.value = true;
    try {
        const res = await apiFetch(`/api/profile/avatar`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data?.error || `Delete failed (${res.status})`); }
        url.value = null; cacheBuster.value = Date.now(); emit('updated', null);
    } catch (err) {
        console.error(err); error.value = err?.message || 'Failed to remove avatar.'; emit('error', error.value);
    } finally { deleting.value = false; }
}
</script>

<style scoped>
.avatar-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.avatar-img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--card-border, #e5e7eb);
}

.avatar-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--badge-bg, #f3f4f6);
    color: var(--text, #111827);
    border: 1px solid var(--card-border, #e5e7eb);
    font-size: 1.25rem;
}

.avatar-actions {
    display: grid;
    gap: 6px;
}
</style>
