<template>
    <div class="card width-100 max-width-px">
        <h2>{{ $t('profile') }}</h2>

        <div v-if="isLoading" class="hint">{{ $t('profile_loading') }}</div>
        <div v-if="loadError" class="error" style="margin-bottom:8px;">{{ loadError }}</div>

        <form @submit.prevent="onSubmit" novalidate class="form" :aria-busy="isSaving || isLoading">
            <!-- Display name -->
            <div class="field">
                <label for="displayName">{{ $t('display_name') }}</label>
                <input id="displayName" v-model.trim="form.displayName" type="text"
                    :class="{ invalid: errors.displayName }" maxlength="60" placeholder="Jane Doe"
                    :disabled="isLoading" />
                <small v-if="errors.displayName" class="error">{{ errors.displayName }}</small>
            </div>

            <!-- Avatar -->
            <AvatarUploader @error="onAvatarError" @updated="onAvatarUpdated" :initial-url="avatarUrl" />

            <!-- Location & radius (all the Google Maps logic lives inside) -->
            <LocationPicker v-model:address="form.address" v-model:latitude="form.latitude"
                v-model:longitude="form.longitude" v-model:radiusKm="form.radiusKm" />

            <!-- Notifications toggle -->
            <div class="field">
                <label for="notifyUponRequestCreation" class="row-inline" style="gap:8px; align-items:center;">
                    <input id="notifyUponRequestCreation" type="checkbox" v-model="form.notifyUponRequestCreation" />
                    <span>{{ $t('notify_on_new_requests') }}</span>
                </label>
                <small class="hint">{{ $t('notify_on_new_requests_help') }}</small>
            </div>

            <!-- Notifications toggle -->
            <div class="field">
                <label for="notifyUponRequestCreationByEmail" class="row-inline" style="gap:8px; align-items:center;">
                    <input id="notifyUponRequestCreationByEmail" type="checkbox" v-model="form.notifyUponRequestCreationByEmail" />
                    <span>{{ $t('notify_on_new_requests_email') }}</span>
                </label>
                <small class="hint">{{ $t('notify_on_new_requests_email_help') }}</small>
            </div>

            <!-- Actions -->
            <div class="actions right">
                <button type="button" class="btn secondary" :disabled="isSaving || isLoading" @click="resetForm">
                    {{ $t('reset') }}
                </button>
                <button type="submit" class="btn primary" :disabled="isSaving || isLoading">
                    <span v-if="!isSaving">{{ $t('save') }}</span>
                    <span v-else>{{ $t('saving') }}</span>
                </button>
            </div>

            <p v-if="saveMessage" class="save-message" :class="{ ok: saveOk, fail: !saveOk }">
                {{ saveMessage }}
            </p>
        </form>
    </div>

    <div class="card width-100 max-width-px" style="margin-top: 10px">
        <!-- Danger Zone (collapsible to reduce clutter) -->
        <div class="danger-zone">
            <h3>{{ $t('danger_zone') }}</h3>
            <p class="hint">{{ $t('delete_account_explain') }}</p>
            <button type="button" class="btn danger" :disabled="deleting || isSaving || isLoading"
                @click="onDeleteAccount">
                <span v-if="!deleting">{{ $t('delete_account') }}</span>
                <span v-else>{{ $t('deleting') }}</span>
            </button>
        </div>
    </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuth } from '../../composables/useAuth';
import LocationPicker from './LocationPicker.vue';
import AvatarUploader from './AvatarUploader.vue';
import { apiFetch } from '../../utils/apiFetch';

const API_URL = import.meta.env.VITE_API_URL;
const DEFAULT_CENTER = { lat: 45.5019, lng: -73.5674 }; // Montreal
const { t } = useI18n();
const { clearUser } = useAuth();

function numOr(def, v) { return typeof v === 'number' && Number.isFinite(v) ? v : def; }

const form = reactive({
    displayName: '',
    address: '',
    latitude: DEFAULT_CENTER.lat,
    longitude: DEFAULT_CENTER.lng,
    radiusKm: 10,
    notifyUponRequestCreation: false,
    notifyUponRequestCreationByEmail: false
});

const original = reactive({ ...form });
const errors = reactive({ displayName: '', address: '', radiusKm: '' });
const billing = reactive({ tier: 'free' });
const isSaving = ref(false);
const isLoading = ref(false);
const loadError = ref('');
const saveMessage = ref('');
const saveOk = ref(false);
const catRef = ref(null);

// Avatar state
const avatarUrl = ref(null);
const deleting = ref(false);

function clearStatus() { saveMessage.value = ''; saveOk.value = false; }

function validate() {
    errors.displayName = '';
    errors.address = '';
    errors.radiusKm = '';

    if (!form.displayName || form.displayName.length < 2) errors.displayName = t('profile_error_displayname_minlen');
    if (!form.address || form.address.length < 4) errors.address = t('profile_error_address_invalid');

    const r = Number(form.radiusKm);
    if (!Number.isFinite(r)) errors.radiusKm = t('profile_error_radius_nan');
    else if (r < 0.1 || r > 500) errors.radiusKm = t('profile_error_radius_range', { min: 0.1, max: 500 });

    return !errors.displayName && !errors.address && !errors.radiusKm;
}

async function loadProfile() {
    isLoading.value = true; loadError.value = '';
    try {
        const res = await apiFetch(`/api/profile`, {
            method: 'GET', credentials: 'include', headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
        const data = await res.json();

        form.displayName = data.displayName ?? '';
        form.address = data.address ?? '';
        form.latitude = numOr(DEFAULT_CENTER.lat, data.latitude);
        form.longitude = numOr(DEFAULT_CENTER.lng, data.longitude);
        form.radiusKm = numOr(10, data.radiusKm);
        form.notifyUponRequestCreation = !!(data.notifyUponRequestCreation ?? false);
        form.notifyUponRequestCreationByEmail = !!(data.notifyUponRequestCreationByEmail ?? false);
        billing.tier = data.accountTier || data.account_tier || 'free';

        Object.assign(original, form);
        avatarUrl.value = data?.avatarUrl || null;
    } catch (err) {
        console.error(err); loadError.value = err?.message || 'Could not load profile.';
    } finally { isLoading.value = false; }
}

async function saveProfile() {
    const res = await apiFetch(`/api/profile`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            displayName: form.displayName,
            address: form.address,
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
            radiusKm: Number(form.radiusKm),
            notifyUponRequestCreation: !!form.notifyUponRequestCreation,
            notifyUponRequestCreationByEmail: !!form.notifyUponRequestCreationByEmail 
        })
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    return res.json().catch(() => ({}));
}

function resetForm() {
    Object.assign(form, original);
    clearStatus();
}

async function onSubmit() {
    clearStatus();
    if (!validate()) return;
    isSaving.value = true;
    try {
        // Save profile first, then favorites (so radius/address are up to date)
        await saveProfile();
        if (catRef.value?.saveFavorites) {
            await catRef.value.saveFavorites();
        }
        Object.assign(original, form);
        saveOk.value = true; saveMessage.value = 'Profile saved!';
    } catch (err) {
        saveOk.value = false; console.error(err);
        saveMessage.value = err?.message || 'Something went wrong.';
    } finally { isSaving.value = false; }
}

async function onDeleteAccount() {
    if (deleting.value) return;

    const answer = window.prompt(t('type_delete_to_confirm'));
    if (!answer || answer.trim().toLowerCase() !== 'delete') {
        saveOk.value = false;
        saveMessage.value = t('delete_cancelled');
        return;
    }

    deleting.value = true;
    saveMessage.value = '';

    try {
        const res = await apiFetch(`/api/profile`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        });

        if (res.ok) {
            await apiFetch(`/logout`, { method: 'POST', credentials: 'include' });
            clearUser();
            window.location.href = '/login';
            return;
        }

        const data = await res.json().catch(() => ({}));

        if (res.status === 409 && data?.error === 'active_subscription') {
            // Just show a message; user must cancel on their own
            saveOk.value = false;
            saveMessage.value = t('active_subscription_block_simple');
            return;
        }

        throw new Error(data?.error || `Delete failed (${res.status})`);
    }
    catch (err) {
        console.error(err);
        saveOk.value = false;
        saveMessage.value = err?.message || t('profile_deactivated_failed');
    }
    finally {
        deleting.value = false;
    }
}

function onAvatarUpdated(url) { avatarUrl.value = url; }
function onAvatarError(msg) { saveOk.value = false; saveMessage.value = msg; }

// mount
loadProfile();
</script>

<style scoped>
.divider {
    margin: 16px 0;
    border: none;
    height: 1px;
    background: var(--card-border, #e5e7eb);
}

.danger-zone {
    margin-top: 8px;
}

.btn.danger {
    background: #ef4444;
    color: #fff;
    border: 1px solid #ef4444;
}

.btn.danger:hover {
    background: #dc2626;
    border-color: #dc2626;
}
</style>