import { Router } from 'express';
import { getUserProfile, updateUserProfile } from '../db.js';

// ----- Validation helpers -----
function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
}

function sanitizeProfileInput(payload) {
    const errors = [];

    const out = {
        displayName: '',
        address: '',
        latitude: 0,
        longitude: 0,
        radiusKm: 0
    };

    // displayName
    if (typeof payload.displayName !== 'string' || payload.displayName.trim().length < 2) {
        errors.push('displayName must be a string with at least 2 characters.');
    } else {
        out.displayName = payload.displayName.trim().slice(0, 60);
    }

    // address
    if (typeof payload.address !== 'string' || payload.address.trim().length < 4) {
        errors.push('address must be a string with at least 4 characters.');
    } else {
        out.address = payload.address.trim().slice(0, 200);
    }

    // latitude
    if (!isFiniteNumber(payload.latitude) || payload.latitude < -90 || payload.latitude > 90) {
        errors.push('latitude must be a number between -90 and 90.');
    } else {
        out.latitude = Number(payload.latitude);
    }

    // longitude
    if (!isFiniteNumber(payload.longitude) || payload.longitude < -180 || payload.longitude > 180) {
        errors.push('longitude must be a number between -180 and 180.');
    } else {
        out.longitude = Number(payload.longitude);
    }

    // radiusKm
    if (!isFiniteNumber(payload.radiusKm)) {
        errors.push('radiusKm must be a number.');
    } else {
        const r = Number(payload.radiusKm);
        if (r < 0.1 || r > 500) {
            errors.push('radiusKm must be between 0.1 and 500.');
        } else {
            out.radiusKm = Math.round(r * 10) / 10; // one decimal place
        }
    }

    return { out, errors };
}

export function mapDbProfileToApi(row) {
    if (row == null) {
        row = {};
    }
    return {
        displayName: row.displayname ?? row.displayName ?? '',
        address: row.address ?? null,
        latitude: typeof row.lat === 'number' ? row.lat : null,
        longitude: typeof row.lng === 'number' ? row.lng : null,
        radiusKm: typeof row.radius_m === 'number' ? row.radius_m / 1000 : null
    };
}

export function createProfileRouter(authenticateJWT) {
    const router = Router();

    // GET /api/profile
    router.get('/', authenticateJWT, async (req, res) => {
        const userId = req.user.id;
        const profileRow = await getUserProfile({ userId });
        res.json(mapDbProfileToApi(profileRow));
    });

    // PUT /api/profile
    router.put('/', authenticateJWT, async (req, res) => {
        const userId = req.user.id;
        const { out, errors } = sanitizeProfileInput(req.body || {});
        if (errors.length) {
            return res.status(400).json({ errors });
        }
        await updateUserProfile({
            userId,
            displayName: out.displayName,
            lat: out.latitude,
            lng: out.longitude,
            address: out.address,
            radius_m: out.radiusKm * 1000
        });
        res.status(200).json({ message: 'Profile updated successfully' });
    });

    return router;
}