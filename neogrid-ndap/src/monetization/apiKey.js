const crypto = require('crypto');

const store = new Map();

function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

function createApiKey(userId, tier = 'FREE') {
  const raw = `${userId}:${tier}:${crypto.randomBytes(24).toString('hex')}`;
  const key = raw;
  const hashed = hashKey(key);
  store.set(hashed, {
    userId,
    tier,
    createdAt: new Date().toISOString(),
    revoked: false,
    usageLimits: null,
    keyHash: hashed,
  });
  return key;
}

function validateApiKey(key) {
  if (!key) return { valid: false, anonymous: true, tier: 'FREE', metadata: null };
  const record = store.get(hashKey(key));
  if (!record || record.revoked) return { valid: false, anonymous: false, tier: null, metadata: null };
  return { valid: true, anonymous: false, tier: record.tier, metadata: { ...record } };
}

function revokeApiKey(key) {
  const record = store.get(hashKey(key));
  if (!record) return false;
  record.revoked = true;
  return true;
}

function getApiKeyRecord(key) {
  return store.get(hashKey(key)) || null;
}

module.exports = { createApiKey, validateApiKey, revokeApiKey, getApiKeyRecord };