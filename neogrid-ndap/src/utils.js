const crypto = require('crypto');

function hashData(data) {
  return crypto.createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');
}

function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

function timestamp() {
  return Date.now();
}

module.exports = { hashData, randomHex, timestamp };
