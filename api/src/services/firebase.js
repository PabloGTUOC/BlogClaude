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
  isMock = true;
  console.warn('Firebase Service Account JSON not found or failed to load. Running in MOCK AUTH MODE (for local development only).');
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
