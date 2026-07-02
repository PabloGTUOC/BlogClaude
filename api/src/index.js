const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const photosRoutes = require('./routes/photos');
const analogRoutes = require('./routes/analog');
const digitalRoutes = require('./routes/digital');
const adminFeedRoutes = require('./routes/admin/feed');
const adminTagsRoutes = require('./routes/admin/tags');
const adminUsersRoutes = require('./routes/admin/users');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = process.env.PORT || 3000;

// Behind Cloudflare Tunnel / Nginx Proxy Manager — trust one proxy hop so
// rate limiting keys on the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);

// Cross-origin resource policy must stay open: the frontend is served from a
// different origin and loads /uploads media via plain <img>/<video> tags.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS locked to the frontend origin (FRONTEND_ORIGIN, e.g. https://blog.enderthoughts.com).
// credentials:true lets the login XHR store the /uploads media cookie.
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());

// Login attempts are the brute-force surface — keep the window tight.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, try again later', code: 'RATE_LIMITED' }
});

// Body parser
app.use(express.json());

// Media is served through an authenticated route (routes/media.js), not
// express.static — gated photos must not be fetchable by URL alone.
const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}
app.use('/uploads', mediaRoutes);

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/analog', analogRoutes);
app.use('/api/digital', digitalRoutes);
app.use('/api/admin/feed', adminFeedRoutes);
app.use('/api/admin/tags', adminTagsRoutes);
app.use('/api/admin/users', adminUsersRoutes);

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', environment: process.env.NODE_ENV || 'production' });
});

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'An internal server error occurred',
    code: err.code || 'INTERNAL_SERVER_ERROR'
  });
});

const { runMigrations } = require('./services/migrations');

// Bootstrap server lifecycle
async function bootstrap() {
  try {
    // Execute SQL migrations sequentially on startup
    await runMigrations();
  } catch (err) {
    console.error('CRITICAL: Database migration bootstrap failed:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`ENDERTHOUGHTS API SERVER RUNNING ON PORT ${PORT}`);
    console.log(`STATIC FILES SERVED FROM: ${uploadPath}`);
    console.log(`===================================================`);
  });
}

bootstrap();
