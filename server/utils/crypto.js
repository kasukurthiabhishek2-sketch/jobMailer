const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const KEY_FILE = path.join(DATA_DIR, '.secret_key');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load or generate persistent encryption key (32 bytes for AES-256)
function getMasterKey() {
  if (process.env.ENCRYPTION_MASTER_KEY && process.env.ENCRYPTION_MASTER_KEY.length === 64) {
    return Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'hex');
  }

  if (fs.existsSync(KEY_FILE)) {
    try {
      const savedKeyHex = fs.readFileSync(KEY_FILE, 'utf8').trim();
      if (savedKeyHex.length === 64) {
        return Buffer.from(savedKeyHex, 'hex');
      }
    } catch (e) {
      console.error('Error reading key file:', e);
    }
  }

  // Generate new random 256-bit key
  const newKey = crypto.randomBytes(32);
  try {
    fs.writeFileSync(KEY_FILE, newKey.toString('hex'), { mode: 0o600 });
  } catch (e) {
    console.error('Could not save encryption key to file:', e);
  }
  return newKey;
}

const MASTER_KEY = getMasterKey();
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a plain text string using AES-256-GCM
 */
function encrypt(plainText) {
  if (!plainText || typeof plainText !== 'string') return '';
  try {
    const iv = crypto.randomBytes(12); // standard 96-bit IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
    
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    throw new Error('Encryption error');
  }
}

/**
 * Decrypt a cipher string formatted as iv:authTag:encrypted
 */
function decrypt(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // Fail closed: strict encrypted format required
    return '';
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const hexRegex = /^[0-9a-fA-F]+$/;

  // Validate standard GCM sizes: IV (12 bytes = 24 hex), AuthTag (16 bytes = 32 hex)
  if (
    ivHex.length !== 24 ||
    authTagHex.length !== 32 ||
    !hexRegex.test(ivHex) ||
    !hexRegex.test(authTagHex) ||
    (encryptedHex.length > 0 && !hexRegex.test(encryptedHex))
  ) {
    return '';
  }

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // Auth tag mismatch or corrupted ciphertext
    return '';
  }
}

/**
 * Mask an API key for safe client display (e.g. sk-abc...1234)
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  const len = key.length;
  if (len <= 16) return '••••••••••••';
  const prefix = key.slice(0, Math.min(6, Math.floor(len / 4)));
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Mask a password for safe client display
 */
function maskPassword(password) {
  if (!password) return '';
  return '••••••••••••';
}

module.exports = {
  encrypt,
  decrypt,
  maskApiKey,
  maskPassword
};
