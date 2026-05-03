const crypto = require('crypto');
const { hashData } = require('../utils');

function _deterministicStr(data) {
  if (typeof data === 'string') return data;
  return JSON.stringify(_canonicalize(data));
}

function _canonicalize(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const s = {};
  for (const k of Object.keys(obj).sort()) s[k] = _canonicalize(obj[k]);
  return s;
}

function generateIdentity() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const pubKeyDER = publicKey.export({ type: 'spki', format: 'der' });
  const pubKeyHex = pubKeyDER.toString('hex');
  const nodeId    = hashData(pubKeyHex);
  return { privateKey, publicKey, nodeId, pubKeyHex };
}

function signData(privateKey, data) {
  const bytes = Buffer.from(_deterministicStr(data));
  return crypto.sign(null, bytes, privateKey).toString('hex');
}

function verifyData(pubKeyHex, data, signatureHex) {
  try {
    const pub = crypto.createPublicKey({
      key:    Buffer.from(pubKeyHex, 'hex'),
      format: 'der',
      type:   'spki',
    });
    const bytes = Buffer.from(_deterministicStr(data));
    return crypto.verify(null, bytes, pub, Buffer.from(signatureHex, 'hex'));
  } catch { return false; }
}

module.exports = { generateIdentity, signData, verifyData };
