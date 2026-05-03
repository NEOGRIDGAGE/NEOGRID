const windows = new Map();
const { getTierConfig } = require('./tierManager');

function nowWindow() {
  return Math.floor(Date.now() / 60000);
}

function checkLimit(apiKey, endpoint, tier = 'FREE') {
  const config = getTierConfig(tier);
  const key = `${apiKey}:${endpoint}`;
  const window = nowWindow();
  const entry = windows.get(key) || { window, count: 0 };
  if (entry.window !== window) {
    entry.window = window;
    entry.count = 0;
  }
  const limit = config.requestLimit;
  if (entry.count >= limit) return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
  entry.count += 1;
  windows.set(key, entry);
  return { allowed: true, remaining: limit === Infinity ? Infinity : Math.max(0, limit - entry.count) };
}

function applyThrottle() {
  return true;
}

module.exports = { checkLimit, applyThrottle };