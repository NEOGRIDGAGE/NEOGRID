const crypto = require('crypto');

const IPFS_API_URL = process.env.IPFS_API_URL || 'http://127.0.0.1:5001';

async function uploadToIPFS(data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);

  try {
    const fetch = require('node-fetch');
    const { Blob } = require('buffer');
    const blob = new Blob([payload], { type: 'application/json' });

    const formData = new (require('form-data'))();
    formData.append('file', Buffer.from(payload), {
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
    return result.Hash;
  } catch {
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    return `ipfs-sim-${hash.slice(0, 46)}`;
  }
}

async function getFromIPFS(cid) {
  try {
    const fetch = require('node-fetch');
    const response = await fetch(`${IPFS_API_URL}/api/v0/cat?arg=${cid}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`IPFS cat failed with ${response.status}`);
    return await response.text();
  } catch {
    return null;
  }
}

module.exports = { uploadToIPFS, getFromIPFS };
