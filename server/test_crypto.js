const assert = require('assert');
const { encrypt, decrypt, maskApiKey, maskPassword } = require('./utils/crypto');

function runTests() {
  console.log('Testing Cryptographic Utilities & Security Properties...');

  // Test 1: Standard encrypt -> decrypt roundtrip
  const secret = 'sk-proj-super-secret-api-key-1234567890abcdef';
  const encrypted = encrypt(secret);
  assert.ok(encrypted.includes(':'), 'Ciphertext must contain colon delimiters');
  const parts = encrypted.split(':');
  assert.strictEqual(parts.length, 3, 'Must have 3 parts (iv:authTag:encrypted)');
  assert.strictEqual(parts[0].length, 24, 'IV must be 24 hex characters (12 bytes)');
  assert.strictEqual(parts[1].length, 32, 'Auth tag must be 32 hex characters (16 bytes)');

  const decrypted = decrypt(encrypted);
  assert.strictEqual(decrypted, secret, 'Decrypted text must match original secret');
  console.log('✓ Roundtrip encryption/decryption passed.');

  // Test 2: IV Uniqueness (Semantic Security)
  const encrypted2 = encrypt(secret);
  assert.notStrictEqual(encrypted, encrypted2, 'Two encryptions of same secret must have distinct IVs');
  assert.strictEqual(decrypt(encrypted2), secret, 'Second ciphertext also decrypts properly');
  console.log('✓ IV uniqueness verified.');

  // Test 3: Tampering Protection (GCM Authenticated Encryption)
  // Tamper with encrypted payload
  const tamperedPayload = parts[0] + ':' + parts[1] + ':' + parts[2].slice(0, -2) + 'ff';
  assert.strictEqual(decrypt(tamperedPayload), '', 'Tampered payload must fail closed and return empty string');

  // Tamper with auth tag
  const tamperedTag = parts[0] + ':' + '00'.repeat(16) + ':' + parts[2];
  assert.strictEqual(decrypt(tamperedTag), '', 'Tampered auth tag must fail closed and return empty string');
  console.log('✓ Tampering detection (GCM auth tag) verified.');

  // Test 4: Malformed inputs & fail-closed behavior
  assert.strictEqual(decrypt('not-an-encrypted-string'), '', 'Arbitrary string must return empty string');
  assert.strictEqual(decrypt('part1:part2'), '', '2-part string must return empty string');
  assert.strictEqual(decrypt('part1:part2:part3:part4'), '', '4-part string must return empty string');
  assert.strictEqual(decrypt('zzzzzzzzzzzzzzzzzzzzzzzz:32charstag00000000000000000000:aabb'), '', 'Non-hex must return empty string');
  assert.strictEqual(decrypt(null), '', 'Null input must return empty string');
  assert.strictEqual(decrypt(''), '', 'Empty input must return empty string');
  console.log('✓ Fail-closed parsing verified.');

  // Test 5: Key Masking
  assert.strictEqual(maskApiKey(''), '');
  assert.strictEqual(maskApiKey('short-key'), '••••••••••••');
  assert.strictEqual(maskApiKey('1234567890123456'), '••••••••••••', 'Keys <= 16 chars must be fully masked');
  const longKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
  const maskedLong = maskApiKey(longKey);
  assert.ok(maskedLong.startsWith('sk-pro...'), 'Long key should have prefix');
  assert.ok(maskedLong.endsWith('wxyz'), 'Long key should have suffix');
  assert.ok(!maskedLong.includes('abcdef'), 'Middle of key must be masked');

  assert.strictEqual(maskPassword('mypassword'), '••••••••••••');
  console.log('✓ Key and password masking verified.');

  console.log('ALL CRYPTO TESTS PASSED!');
}

runTests();
