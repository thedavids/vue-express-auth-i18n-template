import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getUserByGoogleId, createUserFromGoogleProfile } from '../database/dbUsers.js';
import { injectAccessTokens } from '../utils/tokens.js';
import { v4 as uuidv4 } from 'uuid';

const FE_URL = process.env.FE_URL;
const API_URL = process.env.API_URL;
export const GOOGLE_AUTH_ROUTES_PREFIX = 'auth/google';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${API_URL}/${GOOGLE_AUTH_ROUTES_PREFIX}/callback`,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    const existingUser = await getUserByGoogleId(profile.id);
    if (existingUser) {
        return done(null, existingUser);
    }

    const id = uuidv4();
    const newUser = await createUserFromGoogleProfile(id, profile);

    return done(null, newUser);
}));

export function createGoogleAuthRoutes() {
    const router = Router();

    // Start Google login
    router.get('/',
        passport.authenticate('google', { scope: ['profile', 'email'], session: false })
    );

    // Handle callback
    router.get(`/callback`,
        passport.authenticate('google', { failureRedirect: `${FE_URL}/signup`, session: false }),
        (req, res) => {
            injectAccessTokens(req.user, res);
            res.redirect(`${FE_URL}`);
        }
    );

    return router;
}