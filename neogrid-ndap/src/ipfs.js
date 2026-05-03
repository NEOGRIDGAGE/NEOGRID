const crypto = require('crypto');
const { canonicalize } = require('./tx');

const IPFS_API_URL = process.env.IPFS_API_URL || 'http://127.0.0.1:5001';

function canonicalHash(data) {
  const canonical = typeof data === 'string' ? data : canonicalize(data);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function simulateCID(hash) {
  return `ipfs-sim-${hash.slice(0, 46)}`;
}

function validateStateBinding(data, expectedLeafHash) {
  const hash = canonicalHash(data);
  const cid = simulateCID(hash);
  const cidHash = cid.replace('ipfs-sim-', '');
  if (!expectedLeafHash.startsWith(cidHash)) {
    return { valid: false, error: 'ERROR_INVALID_STATE_BINDING: CID hash does not match SMT leaf hash', hash, cid };
  }
  return { valid: true, hash, cid };
}

async function uploadToIPFS(data, smtLeafHash) {
  const canonical = typeof data === 'string' ? data : canonicalize(data);
  const contentHash = canonicalHash(data);

  if (smtLeafHash) {
    const cidHash = smtLeafHash.slice(0, 46);
    if (!contentHash.startsWith(cidHash)) {
      throw new Error(`ERROR_INVALID_STATE_BINDING: content hash ${contentHash.slice(0, 16)}... does not bind to SMT leaf ${smtLeafHash.slice(0, 16)}...`);
    }
  }

  try {
    const fetch = require('node-fetch');
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', Buffer.from(canonical), {
      filename: 'data.json',
      contentType: 'application/json',
    });

    const response = await fetch(`${IPFS_API_URL}/api/v0/add`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });

    if (!response.ok) throw new Error(`IPFS responded with ${response.status}`);
    const result = await response.json();
    return { cid: result.Hash, contentHash };
  } catch {
    const cid = simulateCID(contentHash);
    return { cid, contentHash };
  }
}

async function getFromIPFS(cid) {
  try {
    const fetch = require('node-fetch');
    const response = await fetch(`${IPFS_API_URL}/api/v0/cat?arg=${cid}`, { method: 'POST' });
    if (!response.ok) throw new Error(`IPFS cat failed with ${response.status}`);
    return await response.text();
  } catch {
    return null;
  }
}

module.exports = { uploadToIPFS, getFromIPFS, canonicalHash, simulateCID, validateStateBinding };
