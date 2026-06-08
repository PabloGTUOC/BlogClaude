require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const photosRoutes = require('./routes/photos');
const analogRoutes = require('./routes/analog');
const digitalRoutes = require('./routes/digital');
const adminFeedRoutes = require('./routes/admin/feed');
const adminTagsRoutes = require('./routes/admin/tags');
const adminUsersRoutes = require('./routes/admin/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors({
  origin: '*', // In production, narrow this down to the frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());

// Serve uploads folder statically
const uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}
app.use('/uploads', express.static(uploadPath));

// API Routes
app.use('/api/auth', authRoutes);
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
