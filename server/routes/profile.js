// routes/profile.js
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';

import {
    getUserProfile,
    updateUserProfile,
    updateUserAvatar,
    clearUserAvatar,
    deactivateUser,
} from '../database/dbUsers.js';

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// ---- S3 config (hard requirement) ----
const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION;
const S3_PUBLIC_BASE_URL = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

if (!S3_BUCKET || !S3_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
        'S3 is required but missing configuration. Set S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.'
    );
}

const s3 = new S3Client({ region: S3_REGION });

// Build public URL for a given key
function publicUrlForKey(key) {
    return S3_PUBLIC_BASE_URL
        ? `${S3_PUBLIC_BASE_URL}/${key}`
        : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

// Derive S3 key from a known public URL (works with default or custom base URL)
function keyFromUrl(url) {
    if (!url) return null;
    const bases = [];
    if (S3_PUBLIC_BASE_URL) bases.push(S3_PUBLIC_BASE_URL.replace(/\/+$/, ''));
    bases.push(`https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`);
    bases.push(`https://${S3_BUCKET}.s3.amazonaws.com`);
    for (const base of bases) {
        if (url.startsWith(base + '/')) {
            return url.slice((base + '/').length);
        }
    }
    return null;
}

// ----- Validation helpers -----
function isFiniteNumber(n) {
    return typeof n === 'number' && Number.isFinite(n);
}

function sanitizeProfileInput(payload) {
    const errors = [];
    const out = { displayName: '', address: '', latitude: 0, longitude: 0, radiusKm: 0, notifyUponRequestCreation: false, notifyUponRequestCreationByEmail: false };

    if (typeof payload.displayName !== 'string' || payload.displayName.trim().length < 2) {
        errors.push('displayName must be a string with at least 2 characters.');
    } else {
        out.displayName = payload.displayName.trim().slice(0, 60);
    }

    if (typeof payload.address !== 'string' || payload.address.trim().length < 4) {
        errors.push('address must be a string with at least 4 characters.');
    } else {
        out.address = payload.address.trim().slice(0, 200);
    }

    if (!isFiniteNumber(payload.latitude) || payload.latitude < -90 || payload.latitude > 90) {
        errors.push('latitude must be a number between -90 and 90.');
    } else {
        out.latitude = Number(payload.latitude);
    }

    if (!isFiniteNumber(payload.longitude) || payload.longitude < -180 || payload.longitude > 180) {
        errors.push('longitude must be a number between -180 and 180.');
    } else {
        out.longitude = Number(payload.longitude);
    }

    if (!isFiniteNumber(payload.radiusKm)) {
        errors.push('radiusKm must be a number.');
    } else {
        const r = Number(payload.radiusKm);
        if (r < 0.1 || r > 500) errors.push('radiusKm must be between 0.1 and 500.');
        else out.radiusKm = Math.round(r * 10) / 10;
    }

    if (typeof payload.notifyUponRequestCreation !== 'boolean') {
        errors.push('notifyUponRequestCreation must be a boolean.');
    } else {
        out.notifyUponRequestCreation = payload.notifyUponRequestCreation;
    }

    if (typeof payload.notifyUponRequestCreationByEmail !== 'boolean') {
        errors.push('notifyUponRequestCreation must be a boolean.');
    } else {
        out.notifyUponRequestCreationByEmail = payload.notifyUponRequestCreationByEmail;
    }
    
    return { out, errors };
}

export function mapDbProfileToApi(row) {
    if (row == null) row = {};
    return {
        displayName: row.displayname ?? row.displayName ?? '',
        address: row.address ?? null,
        latitude: typeof row.lat === 'number' ? row.lat : null,
        longitude: typeof row.lng === 'number' ? row.lng : null,
        radiusKm: typeof row.radius_m === 'number' ? row.radius_m / 1000 : null,
        avatarUrl: row.avatarUrl ?? row.avatar_url ?? null,   // ensure SELECT aliases if needed
        avatarKey: row.avatarKey ?? row.avatar_key ?? null,   // include in getUserProfile for easy deletes
        notifyUponRequestCreation: row.notifyUponRequestCreation ?? row.notifyuponrequestcreation ?? false,
        notifyUponRequestCreationByEmail: row.notifyUponRequestCreationByEmail ?? row.notifyuponrequestcreationbyemail ?? false,
        accountTier: row.accountTier ?? row.account_tier ?? null
    };
}

// ---- Avatar upload plumbing (S3 only) ----
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

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
        if (errors.length) return res.status(400).json({ errors });
        await updateUserProfile({
            userId,
            displayName: out.displayName,
            lat: out.latitude,
            lng: out.longitude,
            address: out.address,
            radius_m: out.radiusKm * 1000,
            notifyUponRequestCreation: out.notifyUponRequestCreation,
            notifyUponRequestCreationByEmail: out.notifyUponRequestCreationByEmail
        });
        res.status(200).json({ message: 'Profile updated successfully' });
    });

    // DELETE /api/profile?cancel=period_end|now
    router.delete('/', authenticateJWT, async (req, res) => {
        try {
            const userId = req.user.id;

            // 3) No active subscription → deactivate safely
            await deactivateUser({ userId });
            res.status(200).json({ message: 'profile_deactivated_success' });
        }
        catch (err) {
            console.error('Deactivate failed:', err);
            res.status(500).json({ error: err.message || 'Failed to deactivate profile.' });
        }
    });

    // POST /api/profile/avatar (multipart form-data, field: avatar)
    router.post('/avatar', authenticateJWT, upload.single('avatar'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            const mime = String(req.file.mimetype || '').toLowerCase();
            if (!/^image\/(png|jpe?g|webp)$/.test(mime)) {
                return res.status(400).json({ error: 'Only PNG, JPG, or WEBP allowed' });
            }

            // Normalize -> 512x512 WEBP
            const outBuf = await sharp(req.file.buffer)
                .rotate()
                .resize(512, 512, { fit: 'cover' })
                .webp({ quality: 88 })
                .toBuffer();

            const fileName = `${req.user.id}-v${Date.now()}.webp`;
            const key = path.posix.join('uploads/avatars', fileName);

            // Upload to S3
            await s3.send(
                new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: key,
                    Body: outBuf,
                    ContentType: 'image/webp',
                    CacheControl: 'public, max-age=31536000, immutable',
                })
            );

            const publicUrl = publicUrlForKey(key);
            await updateUserAvatar({ userId: req.user.id, avatarUrl: publicUrl, avatarKey: key });

            return res.json({ avatarUrl: publicUrl });
        } catch (e) {
            console.error('Avatar upload error:', e);
            return res.status(500).json({ error: 'Failed to upload avatar' });
        }
    });

    // DELETE /api/profile/avatar
    router.delete('/avatar', authenticateJWT, async (req, res) => {
        try {
            const profileRow = await getUserProfile({ userId: req.user.id });
            const { avatarUrl, avatarKey } = mapDbProfileToApi(profileRow);

            const key = avatarKey || keyFromUrl(avatarUrl);
            if (key) {
                try {
                    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
                } catch (err) {
                    // ignore cleanup errors
                    console.warn('S3 delete avatar failed (ignored):', err?.Code || err?.name || err);
                }
            }

            await clearUserAvatar({ userId: req.user.id });
            return res.json({ ok: true });
        }
        catch (e) {
            console.error('Avatar delete error:', e);
            return res.status(500).json({ error: 'Failed to remove avatar' });
        }
    });

    return router;
}
