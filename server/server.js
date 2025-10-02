import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';
import csurf from 'csurf';
import helmet from 'helmet';
import { getUserByEmail, getUserById, createUser, updateUserPassword, setUserIsVerified } from './database/dbUsers.js';
import { injectAccessTokens, clearAccessTokens } from './utils/tokens.js';
import { sendEmailVerification, sendPasswordResetEmail } from './services/emails.js';
import { FACEBOOK_AUTH_ROUTES_PREFIX, createFacebookAuthRoutes } from './routes/auth_facebook.js';
import { GOOGLE_AUTH_ROUTES_PREFIX, createGoogleAuthRoutes } from './routes/auth_google.js';
import { createProfileRouter } from './routes/profile.js';

const app = express();
// Trust the proxy/load balancer so req.ip comes from X-Forwarded-For
// On Render/Heroku/most PaaS, use `true`. If you know it's exactly one hop, use `1`.
// before any middleware that reads req.ip (e.g., rate limiters)
if (process.env.NODE_ENV === 'production') {
    // Render: 1 hop (or 2 if Cloudflare sits in front)
    app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
} else {
    // Local/dev
    app.set('trust proxy', false);
}

const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;
const FE_URL = process.env.FE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

const EMAIL_SECRET = process.env.EMAIL_SECRET_ACTIVATION_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

// ---------- Process-level safety nets (recommended) ----------
process.on('unhandledRejection', (reason, p) => {
    console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.disable('x-powered-by');

// CORS config
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            if (process.env.NODE_ENV !== 'production') {
                // console.debug('[CORS] No Origin header (likely same-origin or server-to-server).');
            }
            return callback(null, false);
        }

        try {
            const parsedOrigin = new URL(origin).origin;
            const allowedOrigins = [FE_URL];

            if (allowedOrigins.includes(parsedOrigin)) {
                return callback(null, parsedOrigin);
            } else {
                console.error(`[CORS] Blocked request from origin: ${parsedOrigin}. Allowed: ${allowedOrigins.join(', ')}`);
                return callback(new Error(`CORS: Origin ${parsedOrigin} not allowed`));
            }
        } catch (err) {
            console.error(`[CORS] Invalid origin header: ${origin}`, err);
            return callback(new Error('CORS: Invalid origin'));
        }
    },
    credentials: true
}));

// Middleware
app.use(bodyParser.json({ limit: '200kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '200kb' }));
app.use(cookieParser());

// ======================================================================
// Begin CSRF
// ======================================================================
const csrfMiddleware = csurf({
    cookie: {
        key: 'csrf',                            // cookie name
        sameSite: IS_PROD ? 'None' : 'Lax',     // cross-site in prod
        secure: IS_PROD,                        // requires HTTPS in prod
        httpOnly: false,                        // FE must read or at least receive token
    },
});

// Apply CSRF to browser routes; skip Stripe webhook (server→server)
app.use((req, res, next) => {
    if (req.path === '/api/billing/webhook') return next();
    return csrfMiddleware(req, res, next);
});

// Endpoint the FE calls to get a fresh CSRF token
app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});
// ======================================================================
// End CSRF
// ======================================================================

// ======================================================================
// Begin Auth JWT
// ======================================================================
function authenticateJWT(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

app.post('/refresh-token', async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) {
        return res.status(401).json({ error: 'No refresh token provided' });
    }

    try {
        const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
        const user = await getUserById(payload.id);
        if (!user) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        injectAccessTokens(user, res);

        res.json({ message: 'Tokens refreshed' });
    }
    catch (err) {
        console.error('Refresh token error:', err);
        res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
});
// ======================================================================
// End Auth JWT
// ======================================================================

// ======================================================================
// Begin Local Auth
// ======================================================================
passport.use(new LocalStrategy(
    {
        usernameField: 'email',
        passwordField: 'password'
    },
    async (email, password, done) => {
        const user = await getUserByEmail(email);
        if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
        }

        if (!user.isVerified) {
            return done(null, false, { message: 'Email not verified' });
        }

        const match = await bcrypt.compare(password, user.password);
        return match ? done(null, user) : done(null, false, { message: 'Invalid email or password' });
    }
));

function generateVerificationToken(userId) {
    return jwt.sign({ id: userId }, EMAIL_SECRET, { expiresIn: '1d' });
}

const signUpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many register attempts from this IP. Please try again later.' }
});

// Route: Register
app.post('/register', signUpLimiter, async (req, res) => {
    const { email, displayName, password } = req.body;

    if (!email || !displayName || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!validator.isEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
        return res.status(400).json({ error: 'User already exists' });
    }

    const id = uuidv4();

    const token = generateVerificationToken(id);
    await sendEmailVerification({ email, token });

    const hashedPassword = await bcrypt.hash(password, 10);
    await createUser({ id, email, displayName, hashedPassword });

    res.status(201).json({ message: 'Verification email sent' });
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 requests per windowMs
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many login attempts from this IP. Please try again later.' }
});

app.post('/login', loginLimiter, (req, res, next) => {
    passport.authenticate('local', { session: false }, (err, user, info) => {
        if (err) {
            return next(err);
        }

        if (!user) {
            return res.status(401).json({ error: info?.message || 'Authentication failed' });
        }

        injectAccessTokens(user, res);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName
            }
        });
    })(req, res, next);
});

app.post('/verify', async (req, res) => {
    const { token } = req.body;
    try {
        const payload = jwt.verify(token, EMAIL_SECRET);
        await setUserIsVerified(payload.id);
        res.status(201).json({ message: 'Email verified!' });
    }
    catch (err) {
        console.error('Verification failed:', err);
        throw err;
    }
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Limit each IP to 5 requests per windowMs
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many forgot passwords attempts from this IP. Please try again later.' }
});

app.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
        return res.status(400).json({ error: 'Invalid or missing email' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
        return res.status(200).json({ message: 'If the email exists, a reset link will be sent' });
    }

    const token = jwt.sign({ id: user.id }, EMAIL_SECRET, { expiresIn: '1h' });

    await sendPasswordResetEmail({ email, token });

    return res.status(201).json({ message: 'Password reset link sent' });
});

app.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ error: 'Missing token or password' });
    }

    try {
        const payload = jwt.verify(token, EMAIL_SECRET);
        const user = await getUserById(payload.id);

        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        const hashed = await bcrypt.hash(password, 10);
        await updateUserPassword(user.id, hashed);

        res.status(200).json({ message: 'Password updated successfully' });
    }
    catch (err) {
        console.error('Reset failed:', err);
        return res.status(400).json({ error: 'Invalid or expired token' });
    }
});
// ======================================================================
// End Local Auth
// ======================================================================

// Google Auth
app.use(`/${GOOGLE_AUTH_ROUTES_PREFIX}`, createGoogleAuthRoutes());

// Facebook Auth
app.use(`/${FACEBOOK_AUTH_ROUTES_PREFIX}`, createFacebookAuthRoutes());

// Route: Logout
app.post('/logout', (req, res) => {
    clearAccessTokens(res);
    res.json({ message: 'Logged out' });
});

// Route: Get current user
app.get('/me', authenticateJWT, (req, res) => {
    res.json({ user: req.user });
});

// Profiles
app.use('/api/profile', createProfileRouter(authenticateJWT));

// Test route
app.get('/', (req, res) => res.send('Auth server is running!'));

// CSRF errors → 403
app.use((err, req, res, next) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    return next(err);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
