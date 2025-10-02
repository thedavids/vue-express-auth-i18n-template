<template>
    <div class="container">
        <!-- Address (read-only until user opts in) -->
        <div class="field">
            <label for="address">{{ $t('address_label') }}</label>

            <div class="address-row">
                <input id="address" ref="addressInputRef" v-model="addr" type="text"
                    :class="{ invalid: addressError, readonly: !interactive }" :placeholder="$t('address_placeholder')"
                    autocomplete="off" :disabled="loading" :readonly="!interactive" @focus="onAddressFocus"
                    @click="onAddressClick" />
                <button v-if="!interactive" type="button" class="btn secondary"
                    :class="{ 'cta-highlight': highlightActive }" style="white-space: nowrap;" ref="editBtnRef"
                    @click="enableLocationEditing">
                    {{ $t('profile_changelocation') }}
                </button>
            </div>

            <small v-if="addressError" class="error">{{ addressError }}</small>
            <small v-else-if="!interactive" class="hint">
                {{ $t('profile_location_locked_hint') }}
            </small>
        </div>

        <!-- Map + actions (only after user activates) -->
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

        <!-- Radius -->
        <div class="field">
            <label for="radius">{{ $t('radius_km') }}</label>
            <div class="actions" style="gap:8px; margin:6px 0 2px;">
                <span class="muted">{{ $t('radius_presets') }}:</span>
                <button type="button" class="btn chip" @click="radius = 2">{{ $t('radius_small') }}</button>
                <button type="button" class="btn chip" @click="radius = 5">{{ $t('radius_medium') }}</button>
                <button type="button" class="btn chip" @click="radius = 10">{{ $t('radius_large') }}</button>
            </div>
            <input id="radius" v-model.number="radius" type="number" step="0.1" min="0.1" max="500" placeholder="10"
                :disabled="loading" />
            <small class="hint">0.1–500 km</small>
        </div>

        <!-- Advanced (optional) -->
        <details class="advanced">
            <summary class="muted">{{ $t('advanced') }}</summary>
            <div class="row" style="margin: 8px 0">
                <div class="field">
                    <label for="latitude">{{ $t('latitude') }}</label>
                    <input id="latitude" v-model.number="lat" type="number" step="0.000001" readonly />
                </div>
                <div class="field">
                    <label for="longitude">{{ $t('longitude') }}</label>
                    <input id="longitude" v-model.number="lng" type="number" step="0.000001" readonly />
                </div>
            </div>
            <small class="hint">{{ $t('privacy_mask_note') }}</small>
        </details>
    </div>
</template>

<script setup>
import { ref, watch, nextTick, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const GOOGLE_MAP_API = import.meta.env.VITE_GOOGLE_MAP_API;
const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID;
const SESSION_FLAG = 'profile_map_activated';

const props = defineProps({
    address: { type: String, default: '' },
    latitude: { type: Number, default: 45.5019 },
    longitude: { type: Number, default: -73.5674 },
    radiusKm: { type: Number, default: 10 }
});
const emit = defineEmits(['update:address', 'update:latitude', 'update:longitude', 'update:radiusKm']);

const { t } = useI18n();

// Local state
const loading = ref(false);
const addressError = ref('');
const mapRef = ref(null);
const addressInputRef = ref(null);
const mapActivated = ref(false);
const mapVisible = ref(true);
const geoBusy = ref(false);
const highlightActive = ref(false);
const editBtnRef = ref(null);

// Only becomes true after the user clicks "Change location"
const interactive = ref(false);

// Guard for model<->map sync
const suppressPropSync = ref(false);

// v-model proxies
const addr = computed({
    get: () => props.address,
    set: (v) => emit('update:address', v)
});
const lat = computed({
    get: () => props.latitude,
    set: (v) => emit('update:latitude', v)
});
const lng = computed({
    get: () => props.longitude,
    set: (v) => emit('update:longitude', v)
});
const radius = computed({
    get: () => props.radiusKm,
    set: (v) => emit('update:radiusKm', v)
});

// Google objects
let map; let marker; let circle; let geocoder; let autocomplete;

// ——— Loader helpers (no script injection until user action)
function waitForImportLibrary(maxMs = 7000) {
    return new Promise((resolve, reject) => {
        const start = performance.now();
        (function check() {
            const has = window.google?.importLibrary || window.google?.maps?.importLibrary;
            if (has) return resolve(true);
            if (performance.now() - start > maxMs) return reject(new Error('Google Maps loaded, but importLibrary not available.'));
            setTimeout(check, 25);
        })();
    });
}

function loadGoogleMapsOnce(apiKey) {
    if (window.__gmapsPromise) return window.__gmapsPromise;
    window.__gmapsPromise = new Promise((resolve, reject) => {
        try {
            if (!apiKey || typeof apiKey !== 'string') return reject(new Error('Missing GOOGLE_MAP_API.'));
            if (window.google?.importLibrary || window.google?.maps?.importLibrary) return resolve(window.google);
            const s = document.createElement('script');
            s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
            s.async = true; s.defer = true;
            s.onload = async () => { try { await waitForImportLibrary(); resolve(window.google); } catch (e) { reject(e); } };
            s.onerror = () => reject(new Error('Failed to load Google Maps script.'));
            document.head.appendChild(s);
        } catch (e) { reject(e); }
    });
    return window.__gmapsPromise;
}

// ——— Initialize Autocomplete (only after user enables editing)
async function initAutocomplete() {
    if (autocomplete || !addressInputRef.value) return;

    await loadGoogleMapsOnce(GOOGLE_MAP_API);
    const importLibrary = window.google?.importLibrary || window.google?.maps?.importLibrary;
    const { Autocomplete } = await importLibrary('places');

    const ac = new Autocomplete(addressInputRef.value, {
        fields: ['formatted_address', 'geometry'],
        // Optional: restrict results to cut down on quota
        // types: ['(regions)'],
        // componentRestrictions: { country: ['ca', 'us'] },
    });
    autocomplete = ac;

    ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place?.geometry?.location) return;

        const loc = place.geometry.location;
        addr.value = place.formatted_address || addr.value;
        setLatLng(loc.lat(), loc.lng());

        // Optionally: auto-activate the map once a valid place is chosen
        if (!mapActivated.value) {
            activateMap();
        }
    });
}

// ——— Initialize Map (only after user action)
async function initMap() {
    if (!mapRef.value) return;
    const google = await loadGoogleMapsOnce(GOOGLE_MAP_API);
    const importLibrary = window.google?.importLibrary || window.google?.maps?.importLibrary;
    const [{ Map }, { AdvancedMarkerElement }, { Geocoder }] = await Promise.all([
        importLibrary('maps'), importLibrary('marker'), importLibrary('geocoding')
    ]);

    geocoder = new Geocoder();

    const center = { lat: Number(lat.value), lng: Number(lng.value) };
    map = new Map(mapRef.value, {
        center, zoom: 13, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, mapId: GOOGLE_MAP_ID
    });

    marker = new AdvancedMarkerElement({ map, position: center, gmpDraggable: true });
    circle = new google.maps.Circle({
        map, center, radius: (radius.value || 10) * 1000,
        strokeColor: '#1d4ed8', strokeOpacity: 0.7, strokeWeight: 2,
        fillColor: '#3b82f6', fillOpacity: 0.18, clickable: false, zIndex: 2
    });

    map.addListener('click', (e) => {
        const p = e.latLng; if (!p) return;
        setLatLng(p.lat(), p.lng(), { fromUser: true });
    });
    marker.addListener('dragend', (e) => {
        const p = e.latLng; if (!p) return;
        setLatLng(p.lat(), p.lng(), { fromUser: true });
    });

    // reflect current model
    setLatLng(center.lat, center.lng);
}

// ——— Privacy: snap coordinates to ~150m grid
function snapToGrid(latVal, lngVal, gridDeg = 0.00135) {
    const lat = Math.round(latVal / gridDeg) * gridDeg;
    const lng = Math.round(lngVal / gridDeg) * gridDeg;
    return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function setLatLng(newLat, newLng, { fromUser = false } = {}) {
    const { lat: latFix, lng: lngFix } = snapToGrid(Number(newLat), Number(newLng));
    suppressPropSync.value = true;
    emit('update:latitude', latFix);
    emit('update:longitude', lngFix);

    const pos = { lat: latFix, lng: lngFix };
    if (marker) {
        if (typeof marker.setPosition === 'function') marker.setPosition(pos);
        else marker.position = pos;
    }
    if (circle) circle.setCenter(pos);
    // Reverse geocode is quota-using — only do it on explicit user action
    if (fromUser) updateAddressFromLatLng(pos);
    if (map) map.panTo(pos);

    queueMicrotask(() => { suppressPropSync.value = false; });
}

function pickCoarseLabel(googleResult) {
    if (!googleResult?.address_components) return googleResult?.formatted_address || '';

    const comps = {};
    for (const c of googleResult.address_components) {
        for (const t of c.types) {
            comps[t] = c.short_name || c.long_name;
        }
    }

    // Prefer postal code
    if (comps.postal_code) {
        return comps.postal_code + (comps.country ? `, ${comps.country}` : '');
    }

    // Otherwise, fallback to city + country
    if (comps.locality && comps.country) {
        return `${comps.locality}, ${comps.country}`;
    }

    // Otherwise, region + country
    if (comps.administrative_area_level_1 && comps.country) {
        return `${comps.administrative_area_level_1}, ${comps.country}`;
    }

    // Last resort: formatted address
    return googleResult.formatted_address;
}

async function updateAddressFromLatLng(latLng) {
    if (!geocoder) {
        try {
            const importLibrary = window.google?.importLibrary || window.google?.maps?.importLibrary;
            if (!importLibrary) return;
            const [{ Geocoder }] = await Promise.all([importLibrary('geocoding')]);
            geocoder = new Geocoder();
        } catch { /* ignore */ }
    }
    if (!geocoder) return;
    try {
        const { results } = await geocoder.geocode({ location: latLng });
        if (results && results.length) addr.value = pickCoarseLabel(results[0]);
    } catch { /* ignore */ }
}

function useBrowserLocation() {
    if (!navigator.geolocation) {
        addressError.value = t('geo_not_supported');
        return;
    }

    geoBusy.value = true;

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            setLatLng(latitude, longitude, { fromUser: true });
            geoBusy.value = false;
        },
        (err) => {
            console.warn('Geolocation failed:', err);
            addressError.value = t('geo_unable_to_retrieve');
            if (typeof err.message === 'string') {
                addressError.value += ` ${err.message}`;
            }
            geoBusy.value = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// ——— UX: keep input inert until enabled
async function onAddressFocus() {
    if (!interactive.value) await enableLocationEditing({ focusAddress: true });
}

async function onAddressClick() {
    if (!interactive.value) await enableLocationEditing({ focusAddress: true });
}

async function enableLocationEditing(opts = {}) {
    const { focusAddress = false } = opts;

    interactive.value = true;              // input becomes editable
    await initAutocomplete();              // load Places (once)

    // Activate map (same behavior as the button)
    mapActivated.value = true;
    sessionStorage.setItem(SESSION_FLAG, '1');

    await nextTick();
    if (!map) await initMap();             // init map if not already

    if (focusAddress) {
        // Now that it's editable, put the caret there
        addressInputRef.value?.focus();
        // Optional: select all for quick overwrite
        addressInputRef.value?.select?.();
    }
}

// lifecycle
onMounted(async () => {
    // Respect prior session choice to keep it sticky
    if (sessionStorage.getItem(SESSION_FLAG) === '1') {
        interactive.value = true;
        mapActivated.value = true;
        await nextTick();
        await Promise.all([initAutocomplete(), initMap()]);
    }
});

// watchers
watch(() => mapRef.value, async (el) => {
    if (el && mapActivated.value && !map) {
        await initMap();
    }
});

watch(() => radius.value, (val) => {
    if (circle && Number.isFinite(Number(val))) circle.setRadius(Number(val) * 1000);
});

watch(mapVisible, (v) => {
    if (v && map) requestAnimationFrame(() => map.panTo({ lat: lat.value, lng: lng.value }));
});

watch(() => [props.latitude, props.longitude], ([nLat, nLng], [oLat, oLng]) => {
    if (suppressPropSync.value) return;
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return;
    if (nLat === oLat && nLng === oLng) return;
    setLatLng(nLat, nLng, { fromUser: false });
});
</script>

<style scoped>
.container {
    gap: 14px;
    display: grid;
}

input.readonly {
    cursor: default;
    background: #f9fafb;
    color: #111827;
    /* dark text for readability */
    caret-color: transparent;
    /* no blinking caret while read-only */
    opacity: 1;
    /* ensure full contrast on Safari/iOS */
}

input.readonly::placeholder {
    color: #6b7280;
    /* neutral placeholder */
}

.map {
    width: 100%;
    height: 360px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
}

.btn.chip {
    padding: 4px 10px;
    border-radius: 9999px;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #111827;
    font-size: 12px;
}

.btn.chip:hover {
    background: #f3f4f6;
}

.advanced {
    margin-top: 8px;
}

/* Subtle pulse highlight for the Change location button */
.cta-highlight {
    position: relative;
    outline: 2px solid rgba(59, 130, 246, .6);
    /* blue ring */
    outline-offset: 2px;
    animation: ctaPulse 1.1s ease-out 1;
}

@keyframes ctaPulse {
    0% {
        box-shadow: 0 0 0 0 rgba(59, 130, 246, .35);
        transform: scale(1.00);
    }

    50% {
        box-shadow: 0 0 0 6px rgba(59, 130, 246, .15);
        transform: scale(1.01);
    }

    100% {
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
        transform: scale(1.00);
    }
}

.address-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

@media (max-width: 640px) {
    .map {
        height: 300px;
    }

    .address-row {
        flex-direction: column;
        align-items: normal;
    }
}
</style>
