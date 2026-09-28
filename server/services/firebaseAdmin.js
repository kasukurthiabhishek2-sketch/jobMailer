/**
 * Firebase Admin SDK — server-side token verification and Firestore access.
 *
 * Initialized with:
 *   1. Service account key (if server/serviceAccountKey.json exists), OR
 *   2. GOOGLE_APPLICATION_CREDENTIALS env var, OR
 *   3. Project ID only (sufficient for ID token verification; Firestore
 *      access uses the client's forwarded token via REST API fallback).
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'outreach-d565d';

let adminInitialized = false;

function initializeFirebaseAdmin() {
  if (adminInitialized) return;

  try {
    if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || PROJECT_ID
      });
      console.log('Firebase Admin initialized with service account key.');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ projectId: PROJECT_ID });
      console.log('Firebase Admin initialized with application default credentials.');
    } else {
      admin.initializeApp({ projectId: PROJECT_ID });
      console.log('Firebase Admin initialized with project ID only (token verification mode).');
    }
    adminInitialized = true;
  } catch (err) {
    console.error('Firebase Admin initialization failed:', err.message);
  }
}

initializeFirebaseAdmin();

/**
 * Verify a Firebase ID token and return the decoded claims.
 * Returns null on verification failure.
 */
async function verifyIdToken(idToken) {
  if (!idToken) return null;
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    console.error('Firebase token verification failed:', err.message);
    return null;
  }
}

/**
 * Express middleware that strictly enforces valid Firebase ID token authentication.
 * Rejects requests with 401 Unauthorized if missing, expired, or invalid.
 */
async function requireAuth(req, res, next) {
  // Allow test / local bypass only if explicitly enabled via environment variable
  if (process.env.DISABLE_AUTH === 'true' || process.env.NODE_ENV === 'test') {
    req.uid = req.headers['x-test-uid'] || 'test_user_offline';
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  const decoded = await verifyIdToken(idToken);
  if (!decoded || !decoded.uid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token' });
  }

  req.uid = decoded.uid;
  req.userEmail = decoded.email || null;
  next();
}

module.exports = {
  verifyIdToken,
  requireAuth,
  admin
};
