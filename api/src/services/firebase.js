const admin = require('firebase-admin');
const fs = require('fs');

let firebaseApp = null;
let isMock = false;

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK from file:', error.message);
  }
}

if (!firebaseApp) {
  // Mock auth accepts ANY token as a valid login, so it must never be reachable by
  // misconfiguration alone — it requires an explicit opt-in and a non-production env.
  if (process.env.ALLOW_MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    isMock = true;
    console.warn('ALLOW_MOCK_AUTH is set — running in MOCK AUTH MODE (any token logs in). Local development only.');
  } else {
    console.error(
      'FATAL: Firebase Admin SDK could not be initialized (FIREBASE_SERVICE_ACCOUNT_PATH missing or invalid). ' +
      'Refusing to start without verifiable authentication. Set ALLOW_MOCK_AUTH=true for local development only.'
    );
    process.exit(1);
  }
}

async function verifyIdToken(token) {
  if (isMock) {
    // If we're using a mock admin token:
    if (token === 'mock-admin-token') {
      return {
        uid: 'mock_admin_uid',
        email: 'admin@enderthoughts.com',
        name: 'Admin Developer',
        picture: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=admin'
      };
    }
    // General mock user
    const email = (token && token.includes('@')) ? token : `${token || 'devuser'}@enderthoughts.com`;
    const name = email.split('@')[0].toUpperCase();
    return {
      uid: `mock_uid_${Buffer.from(email).toString('hex').slice(0, 16)}`,
      email,
      name,
      picture: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${name}`
    };
  }

  return admin.auth().verifyIdToken(token);
}

module.exports = {
  verifyIdToken,
  isMock
};
