const crypto = require('crypto');

function hashData(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = { hashData };
