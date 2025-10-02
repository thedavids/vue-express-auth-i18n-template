import pool from './dbConnection.js';
import validator from 'validator';

const NAME_MAX_LENGTH = 254;

export async function getUserByEmail(email) {
    const result = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    return result.rows[0];
}

export async function getUserById(id) {
    const result = await pool.query('SELECT * FROM "User" WHERE id = $1', [id]);
    return result.rows[0];
}

export async function getGeoStatus(userId) {
    const { rows: [u] } = await pool.query(`
    SELECT
      (u."location" IS NOT NULL)        AS "hasLocation",
      (u."search_radius_m" IS NOT NULL) AS "hasRadius",
      u."search_radius_m"               AS radius
    FROM "User" u
    WHERE u.id = $1
  `, [userId]);

    const hasLocation = !!u?.haslocation || !!u?.hasLocation; // pq maps to lowercase sometimes
    const hasRadius = !!u?.hasradius || !!u?.hasRadius;

    return {
        ready: hasLocation && hasRadius,
        hasLocation,
        hasRadius,
        radius: u?.radius ?? null
    };
}

export async function createUser({ id, email, displayName, hashedPassword }) {
    const cleanName = validator.escape(displayName.trim().slice(0, NAME_MAX_LENGTH));

    const result = await pool.query(
        `INSERT INTO "User" (id, email, "displayName", password, "isVerified", "notifyUponRequestCreation", "notifyUponRequestCreationByEmail")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, "displayName"`,
        [id, email, cleanName, hashedPassword, false, true, true]
    );

    return result.rows[0];
}

export async function updateUserPassword(userId, hashedPassword) {
    await pool.query(
        `UPDATE "User" SET password = $1 WHERE id = $2`,
        [hashedPassword, userId]
    );
}

export async function getUserName({ userId }) {
    const sql = `
    SELECT
      "displayName"
    FROM "User"
    WHERE id = $1
    LIMIT 1;
  `;
    const params = [userId];
    const { rows } = await pool.query(sql, params);
    if (rows.length === 0) return null;
    return rows[0];
}

export async function getUserGeoAndRadius(userId) {
    const { rows } = await pool.query(
        `
    SELECT
      ST_Y("location"::geometry) AS lat,
      ST_X("location"::geometry) AS lng,
      "search_radius_m"         AS radius_m
    FROM "User"
    WHERE id = $1 AND "location" IS NOT NULL AND "search_radius_m" IS NOT NULL
    `,
        [userId]
    );
    if (!rows.length) return null;
    return rows[0]; // { lat, lng, radius_m }
}

export async function getUserProfile({ userId }) {
    const sql = `
    SELECT
      "displayName",
      base_address AS address,
      search_radius_m AS radius_m,
      COALESCE(ST_Y(location::geometry), NULL) AS lat,
      COALESCE(ST_X(location::geometry), NULL) AS lng,
      avatar_url AS "avatarUrl",
      "notifyUponRequestCreation",
      "notifyUponRequestCreationByEmail",
      "account_tier"
    FROM "User"
    WHERE id = $1
    LIMIT 1;
  `;
    const params = [userId];
    const { rows } = await pool.query(sql, params);
    if (rows.length === 0) return null;
    return rows[0];
}

export async function updateUserProfile({ userId, displayName, lat, lng, address, radius_m, notifyUponRequestCreation, notifyUponRequestCreationByEmail }) {
    const cleanName = validator.escape(displayName.trim().slice(0, NAME_MAX_LENGTH));
    const addr = address ?? null;

    const sql = `
      UPDATE "User"
      SET
        location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        "displayName" = $3,
        search_radius_m = $4,
        base_address = $5,
        "notifyUponRequestCreation" = $6,
        "notifyUponRequestCreationByEmail" = $7
      WHERE id = $8;
    `;
    const params = [lng, lat, cleanName, radius_m, addr, notifyUponRequestCreation, notifyUponRequestCreationByEmail, userId];
    await pool.query(sql, params);
    return;
}

export async function setUserLocationIfEmpty({ userId, lat, lng, address = null, defaultRadiusM = 10000 }) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    const sql = `
    UPDATE "User"
    SET
      location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, -- lng, lat
      base_address = COALESCE(base_address, $3),
      search_radius_m = COALESCE(search_radius_m, $4)
    WHERE id = $5 AND location IS NULL
    RETURNING id;
  `;
    const params = [lng, lat, address, defaultRadiusM, userId];
    const { rowCount } = await pool.query(sql, params);
    return rowCount > 0;
}

export async function setUserIsVerified(id) {
    const res = await pool.query(`UPDATE "User" SET "isVerified" = true WHERE id = $1`, [id]);
    return res.rows[0];
}

export async function getUserByGoogleId(googleId) {
    const res = await pool.query('SELECT * FROM "User" WHERE "googleId" = $1', [googleId]);
    return res.rows[0] || null;
}

export async function createUserFromGoogleProfile(id, profile) {
    const displayName = profile.displayName;
    const cleanName = validator.escape(displayName.trim().slice(0, NAME_MAX_LENGTH));
    const email = profile.emails?.[0]?.value || null;
    const googleId = profile.id;

    const res = await pool.query(
        `INSERT INTO "User" (id, "displayName", email, "googleId", "isVerified", "notifyUponRequestCreation", "notifyUponRequestCreationByEmail")
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [id, cleanName, email, googleId, true, true, true]
    );
    return res.rows[0];
}

export async function getUserByFacebookId(facebookId) {
    const res = await pool.query('SELECT * FROM "User" WHERE "facebookId" = $1', [facebookId]);
    return res.rows[0] || null;
}

export async function createUserFromFacebook({ id, facebookId, name, email }) {
    const displayName = name == '' ? `fb_user_${facebookId.slice(-6)}` : name;
    const cleanName = validator.escape(displayName.trim().slice(0, NAME_MAX_LENGTH));

    const res = await pool.query(
        `INSERT INTO "User" (id, "displayName", email, "facebookId", "isVerified", "notifyUponRequestCreation", "notifyUponRequestCreationByEmail")
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [id, cleanName, email || null, facebookId, true, true, true]
    );
    return res.rows[0];
}

export async function updateUserAvatar({ userId, avatarUrl, avatarKey }) {
    const { rows: [row] } = await pool.query(
        `UPDATE "User"
       SET avatar_url = $1,
           avatar_key = $2,
           avatar_updated_at = now()
     WHERE id = $3
     RETURNING
       avatar_url AS "avatarUrl",
       avatar_key AS "avatarKey",
       avatar_updated_at AS "avatarUpdatedAt"`,
        [avatarUrl, avatarKey, userId]
    );
    return row; // { avatarUrl, avatarKey, avatarUpdatedAt }
}

// Remove avatar (revert to null)
export async function clearUserAvatar({ userId }) {
    const { rows: [row] } = await pool.query(
        `UPDATE "User"
       SET avatar_url = NULL,
           avatar_key = NULL,
           avatar_updated_at = now()
     WHERE id = $1
     RETURNING
       avatar_url AS "avatarUrl",
       avatar_key AS "avatarKey",
       avatar_updated_at AS "avatarUpdatedAt"`,
        [userId]
    );
    return row; // { avatarUrl: null, avatarKey: null, avatarUpdatedAt }
}

export async function deactivateUser({ userId }) {
    const placeholderEmail = `deleted+${userId}@example.invalid`;
    const sql = `
      UPDATE "User"
      SET
        email = $1,
        password = NULL,
        "displayName" = 'Deleted User',
        "googleId" = NULL,
        "facebookId" = NULL,
        "isVerified" = false,
        location = NULL,
        search_radius_m = NULL,
        base_address = NULL,
        avatar_url = NULL,
        avatar_updated_at = now()
      WHERE id = $2
  `;
    const params = [placeholderEmail, userId];
    await pool.query(sql, params);
}

/**
 * Load a user's favorite categories (ids only).
 * Returns: string[] of category UUIDs
 */
export async function getUserFavoriteCategoryIds(userId) {
    const { rows } = await pool.query(
        `SELECT "categoryId" FROM "UserFavoriteCategory"
     WHERE "userId" = $1 AND notify = TRUE`,
        [userId]
    );
    return rows.map(r => r.categoryId);
}

/**
 * Load a user's favorites WITH localized names (useful for UI).
 * Returns: [{ id, slug, name }]
 */
export async function getUserFavoriteCategoriesDetailed(userId, locale = 'en') {
    const loc = String(locale).slice(0, 8).toLowerCase();
    const { rows } = await pool.query(
        `SELECT c.id, c.slug, COALESCE(ct.name, c.slug) AS name
     FROM "UserFavoriteCategory" f
     JOIN "Category" c ON c.id = f."categoryId"
     LEFT JOIN "CategoryTranslation" ct
       ON ct."categoryId" = c.id AND LOWER(ct."locale") = $1
     WHERE f."userId" = $2 AND f.notify = TRUE
     ORDER BY name ASC`,
        [loc, userId]
    );
    return rows;
}

/**
 * Save (replace) a user's favorite categories.
 * Overwrites the set in one transaction (delete-all-then-insert).
 * Returns: the final saved list (array of UUIDs).
 */
export async function setUserFavoriteCategoryIds(userId, categoryIds) {
    // Validate: dedupe, keep only UUIDs
    const uniq = Array.from(
        new Set(
            (Array.isArray(categoryIds) ? categoryIds : [])
                .filter(id => typeof id === 'string' && validator.isUUID(id))
        )
    );

    if (uniq.length > 100) {
        throw Object.assign(new Error('Too many categories (max 100).'), { status: 400 });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Optionally, ensure all UUIDs exist in Category (silently drop unknowns)
        if (uniq.length > 0) {
            const { rows } = await client.query(
                `SELECT id FROM "Category" WHERE id = ANY($1::uuid[])`,
                [uniq]
            );
            const existing = new Set(rows.map(r => r.id));
            for (let i = uniq.length - 1; i >= 0; i--) {
                if (!existing.has(uniq[i])) uniq.splice(i, 1);
            }
        }

        // Replace the set
        await client.query(
            `DELETE FROM "UserFavoriteCategory" WHERE "userId" = $1`,
            [userId]
        );

        if (uniq.length > 0) {
            await client.query(
                `INSERT INTO "UserFavoriteCategory" ("userId","categoryId",notify)
         SELECT $1, unnest($2::uuid[]), TRUE`,
                [userId, uniq]
            );
        }

        await client.query('COMMIT');
        return uniq;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

// --- Blocks: list, add, remove ---
export async function listMyBlockedUsers({ userId, limit = 50, offset = 0 }) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const off = Math.max(Number(offset) || 0, 0);

    const { rows } = await pool.query(
        `
        SELECT
          ub."blockedUserId" AS "userId",
          u."displayName",
          u.avatar_url AS "avatarUrl",
          ub.details,
          ub."createdAt"
        FROM "UserBlock" ub
        JOIN "User" u ON u.id = ub."blockedUserId"
        WHERE ub."blockerUserId" = $1
        ORDER BY ub."createdAt" DESC
        LIMIT $2 OFFSET $3;
        `,
        [userId, lim, off]
    );
    return rows;
}

export async function blockUser({ blockerUserId, blockedUserId, details = null }) {
    if (!blockerUserId || !blockedUserId) {
        throw Object.assign(new Error('Invalid user IDs'), { status: 400 });
    }
    if (blockerUserId === blockedUserId) {
        throw Object.assign(new Error('Cannot block yourself'), { status: 400 });
    }
    const det = details == null ? null : String(details).slice(0, 800);

    const { rows } = await pool.query(
        `
        INSERT INTO "UserBlock" ("blockerUserId","blockedUserId",details)
        VALUES ($1,$2,$3)
        ON CONFLICT ("blockerUserId","blockedUserId")
        DO UPDATE SET details = EXCLUDED.details
        RETURNING "blockerUserId","blockedUserId",details,"createdAt";
        `,
        [blockerUserId, blockedUserId, det]
    );
    return rows[0];
}

export async function unblockUser({ blockerUserId, blockedUserId }) {
    const { rowCount } = await pool.query(
        `
        DELETE FROM "UserBlock"
        WHERE "blockerUserId" = $1 AND "blockedUserId" = $2;
        `,
        [blockerUserId, blockedUserId]
    );
    return rowCount > 0;
}

// --- Upvotes: add/remove ---

/**
 * Add an upvote from voterUserId -> targetUserId.
 * - No-ops if an active upvote already exists (idempotent).
 * - Respects blocks both directions.
 * - Returns { added: boolean, upvoteCount: number }
 */
export async function addUserUpvote({ voterUserId, targetUserId }) {
    if (!voterUserId || !targetUserId) {
        throw Object.assign(new Error('Missing voter/target'), { status: 400 });
    }
    if (voterUserId === targetUserId) {
        throw Object.assign(new Error('Cannot upvote yourself'), { status: 400 });
    }
    if (!validator.isUUID(voterUserId) || !validator.isUUID(targetUserId)) {
        throw Object.assign(new Error('Invalid UUID(s)'), { status: 400 });
    }

    // Atomically insert only if not blocked either way; ignore if already active
    const insertSql = `
    WITH ins AS (
      INSERT INTO "UserUpvote" ("voterUserId","targetUserId")
      SELECT $1::uuid, $2::uuid
      WHERE NOT EXISTS (
        SELECT 1 FROM "UserBlock"
        WHERE ("blockerUserId" = $1 AND "blockedUserId" = $2)
           OR ("blockerUserId" = $2 AND "blockedUserId" = $1)
      )
      ON CONFLICT ON CONSTRAINT ux_active_unique DO NOTHING
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) > 0 FROM ins) AS added,
      u.upvote_count AS "upvoteCount"
    FROM "User" u
    WHERE u.id = $2;
  `;
    const { rows: [row] } = await pool.query(insertSql, [voterUserId, targetUserId]);

    // If nothing inserted AND upvote_count unchanged, we still return current count.
    // If the failure was due to blocks, "added" will be false.
    return {
        added: !!row?.added,
        upvoteCount: Number(row?.upvoteCount ?? 0),
    };
}

/**
 * Remove (retract) an active upvote from voterUserId -> targetUserId.
 * - No-ops if no active upvote exists (idempotent).
 * - Returns { removed: boolean, upvoteCount: number }
 */
export async function removeUserUpvote({ voterUserId, targetUserId }) {
    if (!voterUserId || !targetUserId) {
        throw Object.assign(new Error('Missing voter/target'), { status: 400 });
    }
    if (!validator.isUUID(voterUserId) || !validator.isUUID(targetUserId)) {
        throw Object.assign(new Error('Invalid UUID(s)'), { status: 400 });
    }

    const retractSql = `
    WITH upd AS (
      UPDATE "UserUpvote"
      SET "retractedAt" = now()
      WHERE "voterUserId" = $1::uuid
        AND "targetUserId" = $2::uuid
        AND "retractedAt" IS NULL
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) > 0 FROM upd) AS removed,
      u.upvote_count AS "upvoteCount"
    FROM "User" u
    WHERE u.id = $2;
  `;
    const { rows: [row] } = await pool.query(retractSql, [voterUserId, targetUserId]);

    return {
        removed: !!row?.removed,
        upvoteCount: Number(row?.upvoteCount ?? 0),
    };
}