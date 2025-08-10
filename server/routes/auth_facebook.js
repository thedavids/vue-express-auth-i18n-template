import { Router } from 'express';
import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { getUserByFacebookId, createUserFromFacebook } from '../db.js';
import { injectAccessTokens } from '../utils/tokens.js';

const FE_URL = process.env.FE_URL;
const API_URL = process.env.API_URL;
export const FACEBOOK_AUTH_ROUTES_PREFIX = 'auth/facebook';

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${API_URL}/${FACEBOOK_AUTH_ROUTES_PREFIX}/callback`,
    profileFields: ['id', 'emails', 'name'] // get email + name
}, async (accessToken, refreshToken, profile, done) => {
    const facebookId = profile.id;
    const email = profile.emails?.[0]?.value;

    const existingUser = await getUserByFacebookId(facebookId);
    if (existingUser) {
        return done(null, existingUser);
    }

    const id = uuidv4();
    const newUser = await createUserFromFacebook({ id, facebookId, email });
    return done(null, newUser);
}));

export function createFacebookAuthRoutes() {
    const router = Router();

    // Start Facebook login
    router.get('/',
        passport.authenticate('facebook', { scope: ['email'], session: false })
    );

    // Handle callback
    router.get(`/callback`,
        passport.authenticate('facebook', { failureRedirect: '/', session: false }),
        (req, res) => {
            injectAccessTokens(req.user, res);
            res.redirect(`${FE_URL}`);
        }
    );

    return router;
}