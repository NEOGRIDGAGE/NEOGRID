const crypto = require('crypto');
const { hashData } = require('./utils');

function generateDID() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  const pubKeyHex = publicKey.toString('hex');
  const did = 'did:neogrid:' + hashData(pubKeyHex);

  return {
    did,
    publicKey: pubKeyHex,
    privateKey: privateKey.toString('hex'),
  };
}

function resolveDID(did) {
  if (!did.startsWith('did:neogrid:')) {
    throw new Error('Invalid DID format — must start with did:neogrid:');
  }
  const id = did.replace('did:neogrid:', '');
  return { did, id, method: 'neogrid' };
}

module.exports = { generateDID, resolveDID };
