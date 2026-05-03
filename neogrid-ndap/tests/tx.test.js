const { createTransaction, signTransaction, verifySignature, validateTxStructure, canonicalize, txHash } = require('../src/tx');
const { generateDID } = require('../src/did');

module.exports = async function(test, suite, assert) {
  await suite('Transaction — strict model', async () => {

    const validFields = () => ({
      fromDID: 'did:neogrid:alice',
      toDID: 'did:neogrid:bob',
      assetId: 'asset-001',
      amount: 10,
      nonce: 'unique-nonce-' + Date.now(),
      timestamp: Date.now(),
    });

    await test('createTransaction produces correct structure', async () => {
      const tx = createTransaction(validFields());
      assert.ok(tx.id, 'tx.id must be set');
      assert.ok(tx.fromDID);
      assert.ok(tx.toDID);
      assert.ok(tx.assetId);
      assert.ok(tx.nonce);
      assert.ok(tx.timestamp);
      assert.strictEqual(tx.signature, null);
    });

    await test('missing fromDID throws', async () => {
      const fields = validFields();
      delete fields.fromDID;
      assert.throws(() => createTransaction(fields), /fromDID/);
    });

    await test('missing nonce throws', async () => {
      const fields = validFields();
      delete fields.nonce;
      assert.throws(() => createTransaction(fields), /nonce/);
    });

    await test('validateTxStructure rejects same fromDID and toDID', async () => {
      const tx = createTransaction({ ...validFields(), toDID: 'did:neogrid:alice', fromDID: 'did:neogrid:alice', nonce: 'n-' + Date.now() });
      const result = validateTxStructure(tx);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('differ')));
    });

    await test('txHash is deterministic', async () => {
      const fields = { ...validFields(), nonce: 'fixed-nonce', timestamp: 1700000000 };
      const tx1 = createTransaction(fields);
      const tx2 = createTransaction(fields);
      assert.strictEqual(txHash(tx1), txHash(tx2));
    });

    await test('different nonce produces different txHash', async () => {
      const f1 = { ...validFields(), nonce: 'nonce-A', timestamp: 1700000000 };
      const f2 = { ...validFields(), nonce: 'nonce-B', timestamp: 1700000000 };
      const tx1 = createTransaction(f1);
      const tx2 = createTransaction(f2);
      assert.notStrictEqual(txHash(tx1), txHash(tx2));
    });

    await test('canonicalize is order-independent', async () => {
      const a = canonicalize({ b: 2, a: 1 });
      const b = canonicalize({ a: 1, b: 2 });
      assert.strictEqual(a, b);
    });

    await test('sign and verify round-trip', async () => {
      const { publicKey, privateKey } = require('crypto').generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      });
      const tx = createTransaction(validFields());
      const signed = signTransaction(tx, privateKey.toString('hex'));
      assert.ok(signed.signature, 'must have signature');
      const valid = verifySignature(signed, publicKey.toString('hex'));
      assert.strictEqual(valid, true);
    });

    await test('tampered signature fails verification', async () => {
      const { publicKey, privateKey } = require('crypto').generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
      });
      const tx = createTransaction(validFields());
      const signed = signTransaction(tx, privateKey.toString('hex'));
      const tampered = { ...signed, signature: 'deadbeef'.repeat(16) };
      const valid = verifySignature(tampered, publicKey.toString('hex'));
      assert.strictEqual(valid, false);
    });
  });
};
