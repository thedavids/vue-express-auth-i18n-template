<!-- ProfileSettingsMap.vue -->
<template>
    <div class="card">
        <h2>{{ $t('profile') }}</h2>

        <!-- Loading / error states for initial fetch -->
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

            <!-- Address with Places Autocomplete (attached after map activation) -->
            <div class="field">
                <label for="address">{{ $t('address') }}</label>
                <input id="address" ref="addressInputRef" v-model="form.address" type="text"
                    :class="{ invalid: errors.address }" placeholder="Start typing an address…"
                    autocomplete="street-address" :disabled="isLoading" />
                <small v-if="errors.address" class="error">{{ errors.address }}</small>
            </div>

            <!-- Lazy activation -->
            <div class="field" v-if="!mapActivated">
                <button type="button" class="btn primary" @click="activateMap" :disabled="isLoading">{{
                    $t('profile_setlocation') }}</button>
            </div>

            <!-- Map (created only after first activation; then can be hidden via v-show without destroying) -->
            <div class="field" v-if="mapActivated">
                <label>{{ $t('profile_picklocation') }}</label>

                <div class="actions" style="justify-content:flex-start; gap:8px; margin:6px 0 8px;">
                    <button type="button" class="btn secondary" @click="mapVisible = !mapVisible">
                        {{ mapVisible ? $t('profile_hidemap') : $t('profile_showmap') }}
                    </button>
                    <button type="button" class="btn secondary" @click="useBrowserLocation" :disabled="geoBusy">
                        {{ geoBusy ? $t('profile_locating') : $t('profile_usemylocation') }}
                    </button>
                </div>

                <div v-show="mapVisible">
                    <div ref="mapRef" class="map"></div>
                    <small class="hint">{{ $t('profile_locationhint') }}</small>
                </div>
            </div>

            <!-- Lat/Lng (read-only) -->
            <div class="row">
                <div class="field">
                    <label for="latitude">{{ $t('latitude') }}</label>
                    <input id="latitude" v-model.number="form.latitude" type="number" step="0.000001" readonly />
                </div>
                <div class="field">
                    <label for="longitude">{{ $t('latitude') }}</label>
                    <input id="longitude" v-model.number="form.longitude" type="number" step="0.000001" readonly />
                </div>
            </div>

            <!-- Radius -->
            <div class="field">
                <label for="radius">{{ $t('radius_km') }}</label>
                <input id="radius" v-model.number="form.radiusKm" type="number" step="0.1" min="0.1" max="500"
                    :class="{ invalid: errors.radiusKm }" placeholder="10" :disabled="isLoading" />
                <small class="hint">0.1–500 km</small>
                <small v-if="errors.radiusKm" class="error">{{ errors.radiusKm }}</small>
            </div>

            <div class="actions right">
                <button type="button" class="btn secondary" :disabled="isSaving || isLoading" @click="resetForm">{{
                    $t('reset') }}</button>
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
</template>

<script setup>
import { onMounted, reactive, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const DEFAULT_CENTER = { lat: 45.5019, lng: -73.5674 }; // Montreal
const GOOGLE_MAP_API = import.meta.env.VITE_GOOGLE_MAP_API;
const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;
const API_URL = import.meta.env.VITE_API_URL;
const SESSION_FLAG = 'profile_map_activated';

function numOr(def, v) { return typeof v === 'number' && Number.isFinite(v) ? v : def; }

const form = reactive({
    displayName: '',
    address: '',
    latitude: DEFAULT_CENTER.lat,
    longitude: DEFAULT_CENTER.lng,
    radiusKm: 10
});

const { t } = useI18n();
const original = reactive({ ...form });
const errors = reactive({ displayName: '', address: '', radiusKm: '' });
const isSaving = ref(false);
const isLoading = ref(false);
const loadError = ref('');
const saveMessage = ref('');
const saveOk = ref(false);

// Refs
const mapRef = ref(null);
const addressInputRef = ref(null);

// Lazy activation state
const mapActivated = ref(false);
const mapVisible = ref(true);
const geoBusy = ref(false);

// Google Maps objects
let map;
let marker;
let circle;
let geocoder;
let autocomplete;

// -------- Server IO --------
async function loadProfile() {
    isLoading.value = true;
    loadError.value = '';
    try {
        const res = await fetch(`${API_URL}/api/profile`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            throw new Error(`Failed to load profile (${res.status})`);
        }
        const data = await res.json();
        fillFormFrom(data);
        Object.assign(original, form);
        // If map already active, sync marker/circle.
        if (map && Number.isFinite(form.latitude) && Number.isFinite(form.longitude)) {
            setLatLng(form.latitude, form.longitude);
            if (circle) circle.setRadius(Number(form.radiusKm) * 1000);
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        loadError.value = err?.message || 'Could not load profile.';
    }
    finally {
        isLoading.value = false;
    }
}

function fillFormFrom(p) {
    if (!p || typeof p !== 'object') return;
    form.displayName = p.displayName ?? '';
    form.address = p.address ?? '';
    form.latitude = numOr(DEFAULT_CENTER.lat, p.latitude);
    form.longitude = numOr(DEFAULT_CENTER.lng, p.longitude);
    form.radiusKm = numOr(10, p.radiusKm);
}

async function saveProfile() {
    const res = await fetch(`${API_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            displayName: form.displayName,
            address: form.address,
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
            radiusKm: Number(form.radiusKm)
        })
    });
    if (!res.ok) {
        throw new Error(`Save failed (${res.status})`);

    }
    return res.json().catch(() => ({}));
}

// -------- Google Maps loader (singleton) --------
function waitForImportLibrary(maxMs = 5000) {
    return new Promise((resolve, reject) => {
        const start = performance.now();
        (function check() {
            const has = window.google?.importLibrary || window.google?.maps?.importLibrary;
            if (has) {
                return resolve(true);
            }
            if (performance.now() - start > maxMs) {
                return reject(new Error('Google Maps loaded, but importLibrary did not become available.'));
            }
            setTimeout(check, 25); // quick, lightweight poll
        })();
    });
}

function loadGoogleMapsOnce(apiKey) {
    if (window.__gmapsPromise) return window.__gmapsPromise;

    window.__gmapsPromise = new Promise((resolve, reject) => {
        try {
            if (!apiKey || typeof apiKey !== 'string') {
                return reject(new Error('Google Maps API key is missing or invalid (GOOGLE_MAP_API).'));
            }

            // Already ready?
            if (window.google?.importLibrary || window.google?.maps?.importLibrary) {
                return resolve(window.google);
            }

            const s = document.createElement('script');
            s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
            s.async = true;
            s.defer = true;

            s.onload = async () => {
                try {
                    await waitForImportLibrary(); // no arbitrary timeout; resolves as soon as it’s attached
                    resolve(window.google);
                } catch (err) {
                    reject(err);
                }
            };
            s.onerror = () => reject(new Error('Failed to load Google Maps script (network/CSP/adblock?).'));

            document.head.appendChild(s);
        } catch (e) {
            reject(e);
        }
    });

    return window.__gmapsPromise;
}

// -------- UI helpers --------
function clearStatus() {
    saveMessage.value = '';
    saveOk.value = false;
}

function validate() {
    errors.displayName = '';
    errors.address = '';
    errors.radiusKm = '';

    if (!form.displayName || form.displayName.length < 2) {
        errors.displayName = t('profile_error_displayname_minlen');
    }

    if (!form.address || form.address.length < 4) {
        errors.address = t('profile_error_address_invalid');
    }

    const r = Number(form.radiusKm);
    if (!Number.isFinite(r)) {
        errors.radiusKm = t('profile_error_radius_nan');
    }
    else if (r < 0.1 || r > 500) {
        errors.radiusKm = t('profile_error_radius_range', { min: 0.1, max: 500 });
    }

    return !errors.displayName && !errors.address && !errors.radiusKm;
}

async function updateAddressFromLatLng(latLng) {
    if (!geocoder) {
        return;
    }
    try {
        const { results } = await geocoder.geocode({ location: latLng });
        if (results && results.length) {
            form.address = results[0].formatted_address;
        }
    }
    catch {
        // ignore
    }
}

function setLatLng(lat, lng, { fromUser = false } = {}) {
    form.latitude = Number(lat.toFixed(6));
    form.longitude = Number(lng.toFixed(6));
    const pos = { lat: form.latitude, lng: form.longitude };

    // AdvancedMarkerElement uses the 'position' property (no setPosition).
    if (marker) {
        if (typeof marker.setPosition === 'function') {
            marker.setPosition(pos);
        }
        else {
            marker.position = pos;
        }
    }

    if (circle) circle.setCenter(pos);
    if (fromUser) updateAddressFromLatLng(pos);
    if (map) map.panTo(pos);
}

async function initMap(google) {
    if (!mapRef.value) {
        // eslint-disable-next-line no-console
        console.warn('mapRef is not ready yet.');
        return;
    }

    const importLibrary = window.google?.importLibrary || window.google?.maps?.importLibrary;

    // Import the modules you need (modern API)
    const [{ Map }, { AdvancedMarkerElement }, { Autocomplete }, { Geocoder }] = await Promise.all([
        importLibrary('maps'),
        importLibrary('marker'),
        importLibrary('places'),
        importLibrary('geocoding')
    ]);

    geocoder = new Geocoder();

    const center = { lat: form.latitude, lng: form.longitude };

    map = new Map(mapRef.value, {
        center,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        mapId: GOOGLE_MAP_ID
    });

    // Advanced Marker (recommended)
    marker = new AdvancedMarkerElement({
        map,
        position: center,
        gmpDraggable: true
    });

    // Radius circle (unchanged)
    circle = new google.maps.Circle({
        map,
        center,
        radius: (form.radiusKm || 10) * 1000,
        strokeColor: '#1d4ed8',   // visible outline
        strokeOpacity: 0.7,
        strokeWeight: 2,
        fillColor: '#3b82f6',     // visible fill
        fillOpacity: 0.18,
        clickable: false,
        zIndex: 2,
    });

    // Map click → move marker + reverse geocode
    map.addListener('click', (e) => {
        const pos = e.latLng;
        if (!pos) return;
        setLatLng(pos.lat(), pos.lng(), { fromUser: true });
    });

    // Drag end → update
    marker.addListener('dragend', (e) => {
        const pos = e.latLng;
        if (!pos) return;
        setLatLng(pos.lat(), pos.lng(), { fromUser: true });
    });

    // Places Autocomplete
    if (addressInputRef.value) {
        const ac = new Autocomplete(addressInputRef.value, {
            fields: ['formatted_address', 'geometry']
            // componentRestrictions: { country: 'ca' },
        });
        autocomplete = ac;
        ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (!place?.geometry?.location) return;
            const loc = place.geometry.location;
            form.address = place.formatted_address || form.address;
            setLatLng(loc.lat(), loc.lng());
        });
    }
}

// Lazy activation handler
async function activateMap() {
    if (mapActivated.value) return;
    mapActivated.value = true;
    sessionStorage.setItem(SESSION_FLAG, '1');
    await nextTick();
    const google = await loadGoogleMapsOnce(GOOGLE_MAP_API).catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        saveMessage.value = 'Failed to load Google Maps.';
        saveOk.value = false;
    });
    if (google && mapRef.value && !map) {
        initMap(google);
    }
}

// Geolocate user (optional)
function useBrowserLocation() {
    if (!navigator.geolocation) return;
    geoBusy.value = true;
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            setLatLng(latitude, longitude, { fromUser: true });
            geoBusy.value = false;
        },
        () => { geoBusy.value = false; },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// Auto-activate if already done earlier in this session
onMounted(async () => {
    await loadProfile();
    if (sessionStorage.getItem(SESSION_FLAG) === '1') {
        mapActivated.value = true;
        await nextTick();
        const google = await loadGoogleMapsOnce(GOOGLE_MAP_API).catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
        });
        if (google && mapRef.value && !map) {
            initMap(google);
        }
    }
});

// If the ref appears later (tabs, etc.), initialize then
watch(() => mapRef.value, async (el) => {
    if (el && mapActivated.value && !map) {
        const google = window.google?.maps ? window.google : await loadGoogleMapsOnce(GOOGLE_MAP_API).catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
        });
        if (google) {
            initMap(google);
        }
    }
});

// Keep circle radius synced
watch(() => form.radiusKm, (val) => {
    if (circle && Number.isFinite(Number(val))) circle.setRadius(Number(val) * 1000);
});

function resetForm() {
    Object.assign(form, original);
    clearStatus();
    if (map) setLatLng(original.latitude, original.longitude);
    if (circle) circle.setRadius(Number(original.radiusKm) * 1000);
}

async function onSubmit() {
    clearStatus();
    if (!validate()) return;
    isSaving.value = true;
    try {
        const data = await saveProfile();
        Object.assign(original, form);
        saveOk.value = true;
        saveMessage.value = 'Profile saved!';
        // Sync map if active and values changed.
        if (map && Number.isFinite(form.latitude) && Number.isFinite(form.longitude)) {
            setLatLng(form.latitude, form.longitude);
            if (circle) circle.setRadius(Number(form.radiusKm) * 1000);
        }
    } catch (err) {
        saveOk.value = false;
        // eslint-disable-next-line no-console
        console.error(err);
        saveMessage.value = err?.message || 'Something went wrong.';
    } finally {
        isSaving.value = false;
    }
}
</script>

<style scoped>
.map {
    width: 100%;
    height: 360px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
}

@media (max-width: 640px) {
    .row {
        grid-template-columns: 1fr;
    }

    .map {
        height: 300px;
    }
}
</style>
