
import net from 'node:net';
import { setUserLocationIfEmpty } from '../database/dbUsers.js';

function stripV6Mapped(ip) {
    return ip?.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function isPublicIp(ip) {
    ip = stripV6Mapped(ip);
    if (!net.isIP(ip)) return false;

    // IPv4
    if (net.isIPv4(ip)) {
        const [a, b, c] = ip.split('.').map(Number);

        // non-routable / private / special
        if (a === 0) return false;                      // 0.0.0.0/8
        if (a === 10) return false;                     // 10.0.0.0/8
        if (a === 100 && b >= 64 && b <= 127) return false;  // 100.64.0.0/10 (CGNAT)
        if (a === 127) return false;                    // 127.0.0.0/8 (loopback)
        if (a === 169 && b === 254) return false;       // 169.254.0.0/16 (link-local)
        if (a === 172 && b >= 16 && b <= 31) return false;   // 172.16.0.0/12
        if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // 192.0.0.0/24, 192.0.2.0/24 (doc)
        if (a === 192 && b === 168) return false;       // 192.168.0.0/16
        if (a === 198 && (b === 18 || b === 19)) return false; // 198.18.0.0/15 (benchmark)
        if (a === 198 && b === 51 && c === 100) return false; // 198.51.100.0/24 (doc)
        if (a === 203 && b === 0 && c === 113) return false;  // 203.0.113.0/24 (doc)
        if (a >= 224) return false;                    // 224.0.0.0/4 multicast & 240.0.0.0/4 reserved

        return true;
    }

    // IPv6
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return false;           // unspecified / loopback
    if (s.startsWith('fe80')) return false;                // link-local
    if (s.startsWith('fc') || s.startsWith('fd')) return false; // unique local (fc00::/7)
    if (s.startsWith('2001:db8')) return false;            // documentation
    return true;
}

// Grab a public client IP from common headers
export function getClientIp(req) {
    // Best option once trust proxy is enabled
    const ip = stripV6Mapped(req.ip);
    if (isPublicIp(ip)) {
        return ip;
    }

    // Fallback: parse common headers (Render sets X-Forwarded-For)
    const chain = (
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.headers['x-client-ip'] ||
        req.headers['cf-connecting-ip'] ||   // present only if you add Cloudflare
        req.socket?.remoteAddress ||
        ''
    ).toString();

    for (const raw of chain.split(',').map(s => s.trim()).filter(Boolean)) {
        const cand = stripV6Mapped(raw);
        if (isPublicIp(cand)) {
            return cand;
        }
    }
    return null;
}

// simple fetch with timeout
async function fetchJson(url, { timeoutMs = 10000 } = {}) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
        const r = await fetch(url, { signal: ac.signal });
        if (!r.ok) return null;
        return await r.json();
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(t);
    }
}

// Try ipwho.is → ipapi.co → ip-api.com → ipinfo.io; return {lat,lng,address}
async function geoLookup(ip) {
    if (!ip) return null;

    // 1) ipwho.is (HTTPS, no key)
    {
        const q = await fetchJson(
            `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,latitude,longitude,city,region,country,postal`
        );
        if (q?.success && Number.isFinite(q.latitude) && Number.isFinite(q.longitude)) {
            const address = [q.postal, q.city, q.region, q.country].filter(Boolean).join(', ') || null;
            return { lat: q.latitude, lng: q.longitude, address };
        }
    }

    // 2) ipapi.co (HTTPS, no key)
    {
        const q = await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
        if (q && Number.isFinite(q.latitude) && Number.isFinite(q.longitude)) {
            const address = [q.postal, q.city, q.region, q.country_name].filter(Boolean).join(', ') || null;
            return { lat: q.latitude, lng: q.longitude, address };
        }
    }

    // 3) ip-api.com (HTTP only on free tier; skip in HTTPS browser to avoid mixed-content)
    {
        const isBrowser = typeof window !== 'undefined' && typeof location !== 'undefined';
        const isHttpsPage = isBrowser && location.protocol === 'https:';
        if (!isHttpsPage) {
            const q = await fetchJson(
                `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon,city,regionName,country,zip`
            );
            if (q?.status === 'success' && Number.isFinite(q.lat) && Number.isFinite(q.lon)) {
                const address = [q.zip, q.city, q.regionName, q.country].filter(Boolean).join(', ') || null;
                return { lat: q.lat, lng: q.lon, address };
            }
        }
    }

    // 4) ipinfo.io (HTTPS, no key for very limited usage; good last resort)
    {
        const q = await fetchJson(`https://ipinfo.io/${encodeURIComponent(ip)}/json`);
        // q.loc is "lat,lng"
        const [lat, lng] = (q?.loc || '').split(',').map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const address = [q?.postal, q?.city, q?.region, q?.country].filter(Boolean).join(', ') || null;
            return { lat, lng, address };
        }
    }

    return null;
}

// Fire-and-forget best-effort updater
export async function bestEffortIpGeo(req, userId) {
    try {
        const ip = getClientIp(req);
        console.log('bestEffortIpGeo ip', ip);
        if (!ip) return;

        const geo = await geoLookup(ip);
        console.log('bestEffortIpGeo geo', geo);
        if (!geo) return;

        // Don’t throw if it doesn’t update (maybe already set)
        await setUserLocationIfEmpty({
            userId,
            lat: geo.lat,
            lng: geo.lng,
            address: geo.address,
            defaultRadiusM: 10000 // 10km default; tweak if you like
        });
    }
    catch (err) {
        console.warn('Best-effort IP geolocation failed:', err?.message || err);
    }
}
