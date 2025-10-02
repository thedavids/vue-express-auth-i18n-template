// crypto.js
import crypto from 'crypto';

const MASTER_KEY_B64 = process.env.MESSAGE_MASTER_KEY_B64; // 32 bytes base64
if (!MASTER_KEY_B64) throw new Error('MESSAGE_MASTER_KEY_B64 missing');

const MASTER_KEY = Buffer.from(MASTER_KEY_B64, 'base64');
if (MASTER_KEY.length !== 32) throw new Error('MESSAGE_MASTER_KEY_B64 must decode to 32 bytes');

// --- helpers for canonical AAD ---
const uuidToBytes = (uuid) => Buffer.from(uuid.replace(/-/g, ''), 'hex');
export const aadFor = (conversationId, senderId, messageId) =>
    Buffer.concat([uuidToBytes(conversationId), uuidToBytes(senderId), uuidToBytes(messageId)]);

// Derive per-conversation subkey
export function deriveConversationKey(conversationId) {
    const salt = uuidToBytes(conversationId);
    return crypto.hkdfSync('sha256', MASTER_KEY, salt, Buffer.from('msg:v1'), 32);
}

// Coerce PG values to Buffer (handles Buffer, \x... hex string, or base64)
const toBuf = (x) => {
    if (Buffer.isBuffer(x)) return x;
    if (typeof x === 'string') {
        if (x.startsWith('\\x')) return Buffer.from(x.slice(2), 'hex');
        return Buffer.from(x, 'base64');
    }
    return Buffer.from(x);
};

export function encryptBody(plaintext, subkey, aadBuf) {
    const iv = crypto.randomBytes(12); // AES-GCM 96-bit IV
    const cipher = crypto.createCipheriv('aes-256-gcm', subkey, iv);
    cipher.setAAD(aadBuf);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { enc, iv, tag, enc_v: 1 };
}

export function decryptBody({ enc, iv, tag, subkey, aad }) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', subkey, toBuf(iv));
    decipher.setAAD(aad);
    decipher.setAuthTag(toBuf(tag));
    const dec = Buffer.concat([decipher.update(toBuf(enc)), decipher.final()]);
    return dec.toString('utf8');
}
