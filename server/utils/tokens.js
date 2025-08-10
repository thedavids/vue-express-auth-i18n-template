// utils/tokens.js
import jwt from 'jsonwebtoken';

const IS_PROD = process.env.NODE_ENV === 'production';
const DOMAIN = IS_PROD ? process.env.COOKIE_DOMAIN_PROD : undefined;

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const COOKIE_REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

const JWT_MAX_AGE = '15m';
const REFRESH_TOKEN_MAX_AGE = '30d';

export function getAccessTokenCookieProperties() {
    return {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: IS_PROD ? 'None' : 'Lax',
        domain: DOMAIN,
        maxAge: COOKIE_MAX_AGE,
    };
}

export function getRefreshTokenCookieProperties() {
    return {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: IS_PROD ? 'None' : 'Lax',
        domain: DOMAIN,
        maxAge: COOKIE_REFRESH_TOKEN_MAX_AGE,
        path: '/refresh-token' // limit to one endpoint
    };
}

/**
 * Create short-lived access token
 */
export function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            displayName: user.displayName
        },
        JWT_SECRET,
        { expiresIn: JWT_MAX_AGE }
    );
}

/**
 * Create long-lived refresh token
 */
export function generateRefreshToken(user) {
    return jwt.sign(
        {
            id: user.id
        },
        REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_MAX_AGE }
    );
}

/**
 * Injects cookies into the response (access + refresh)
 */
export function injectAccessTokens(user, res) {
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie('token', accessToken, getAccessTokenCookieProperties());
    res.cookie('refreshToken', refreshToken, getRefreshTokenCookieProperties());
}

/**
 * Clear cookies into the response (access + refresh)
 */
export function clearAccessTokens(res) {
    res.clearCookie('token', getAccessTokenCookieProperties());
    res.clearCookie('refreshToken', getRefreshTokenCookieProperties());
}