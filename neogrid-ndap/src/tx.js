const crypto = require('crypto');
const { hashData } = require('./utils');

function createTransaction(payload) {
  const tx = {
    id: hashData(JSON.stringify(payload) + Date.now()),
    payload,
    timestamp: payload.timestamp || Date.now(),
    signature: null,
  };
  return tx;
}

function signTransaction(tx, privateKeyHex) {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyHex, 'hex'),
    format: 'der',
    type: 'pkcs8',
  });

  const data = Buffer.from(JSON.stringify(tx.payload));
  const signature = crypto.sign(null, data, privateKey);
  return { ...tx, signature: signature.toString('hex') };
}

function verifyTransaction(tx, publicKeyHex) {
  if (!tx || !tx.signature) return false;

  try {
    if (publicKeyHex) {
      const publicKey = crypto.createPublicKey({
        key: Buffer.from(publicKeyHex, 'hex'),
        format: 'der',
        type: 'spki',
      });
      const data = Buffer.from(JSON.stringify(tx.payload));
      return crypto.verify(null, data, publicKey, Buffer.from(tx.signature, 'hex'));
    }

    return !!(tx.id && tx.payload && tx.timestamp);
  } catch {
    return false;
  }
}

module.exports = { createTransaction, signTransaction, verifyTransaction };
