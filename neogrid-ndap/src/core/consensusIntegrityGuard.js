const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const version = require('./version');

const LOCKED_HASH_PATH = path.join(__dirname, '../../spec/core-hash.json');

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function loadLockedHash() {
  if (!fs.existsSync(LOCKED_HASH_PATH)) return null;
  return JSON.parse(fs.readFileSync(LOCKED_HASH_PATH, 'utf8'));
}

function assertConsensusSafetyEnforcement() {
  const locked = loadLockedHash();
  if (!locked) return;

  const current = {
    consensus: hashFile(path.join(__dirname, '../consensus/bft.js')),
    validator: hashFile(path.join(__dirname, '../consensus/validator.js')),
    smt: hashFile(path.join(__dirname, '../smt.js')),
    bft: hashFile(path.join(__dirname, '../consensus/bft.js')),
  };

  const coreModifiedDetected = Object.keys(current).some((key) => locked[key] && locked[key] !== current[key]);
  if (coreModifiedDetected && version.version !== '1.0.0') {
    throw new Error('PROTOCOL_CORE_MODIFICATION_NOT_ALLOWED');
  }
}

module.exports = { assertConsensusSafetyEnforcement };