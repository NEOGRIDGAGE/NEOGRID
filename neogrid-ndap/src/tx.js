const crypto = require('crypto');
const { hashData } = require('./utils');

const REQUIRED_FIELDS = ['fromDID', 'toDID', 'assetId', 'nonce', 'timestamp'];

function canonicalize(obj) {
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
  if (obj !== null && typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
  }
  return JSON.stringify(obj);
}

function txHash(tx) {
  const { signature: _sig, id: _id, ...rest } = tx;
  return hashData(canonicalize(rest));
}

function createTransaction(fields) {
  for (const f of REQUIRED_FIELDS) {
    if (fields[f] === undefined || fields[f] === null || fields[f] === '') {
      throw new Error(`Missing required transaction field: ${f}`);
    }
  }
  const tx = {
    fromDID: fields.fromDID,
    toDID: fields.toDID,
    assetId: fields.assetId,
    amount: fields.amount || 0,
    nonce: fields.nonce,
    timestamp: fields.timestamp,
    signature: null,
  };
  tx.id = txHash(tx);
  return tx;
}

function signTransaction(tx, privateKeyHex) {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyHex, 'hex'),
    format: 'der',
    type: 'pkcs8',
  });
  const data = Buffer.from(canonicalize({ fromDID: tx.fromDID, toDID: tx.toDID, assetId: tx.assetId, amount: tx.amount, nonce: tx.nonce, timestamp: tx.timestamp }));
  const sig = crypto.sign(null, data, privateKey);
  return { ...tx, signature: sig.toString('hex') };
}

function verifySignature(tx, publicKeyHex) {
  if (!tx || !tx.signature) return false;
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyHex, 'hex'),
      format: 'der',
      type: 'spki',
    });
    const data = Buffer.from(canonicalize({ fromDID: tx.fromDID, toDID: tx.toDID, assetId: tx.assetId, amount: tx.amount, nonce: tx.nonce, timestamp: tx.timestamp }));
    return crypto.verify(null, data, publicKey, Buffer.from(tx.signature, 'hex'));
  } catch {
    return false;
  }
}

function validateTxStructure(tx) {
  const errors = [];
  for (const f of REQUIRED_FIELDS) {
    if (!tx[f] && tx[f] !== 0) errors.push(`Missing: ${f}`);
  }
  if (tx.fromDID === tx.toDID) errors.push('fromDID and toDID must differ');
  if (tx.timestamp && (Date.now() - tx.timestamp) > 300_000) errors.push('Transaction timestamp is stale (>5 min)');
  return { valid: errors.length === 0, errors };
}

module.exports = { createTransaction, signTransaction, verifySignature, validateTxStructure, canonicalize, txHash };
