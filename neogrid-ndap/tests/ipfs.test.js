const { uploadToIPFS, canonicalHash, simulateCID, validateStateBinding } = require('../src/ipfs');

module.exports = async function(test, suite, assert) {
  await suite('IPFS — state binding', async () => {

    await test('canonicalHash is deterministic', async () => {
      const data = { name: 'asset', value: 42 };
      const h1 = canonicalHash(data);
      const h2 = canonicalHash(data);
      assert.strictEqual(h1, h2);
    });

    await test('canonicalHash is order-independent', async () => {
      const h1 = canonicalHash({ b: 2, a: 1 });
      const h2 = canonicalHash({ a: 1, b: 2 });
      assert.strictEqual(h1, h2);
    });

    await test('simulateCID produces consistent prefix', async () => {
      const hash = 'a'.repeat(64);
      const cid = simulateCID(hash);
      assert.ok(cid.startsWith('ipfs-sim-'));
      assert.ok(cid.includes(hash.slice(0, 46)));
    });

    await test('uploadToIPFS returns cid and contentHash', async () => {
      const data = { test: true, id: 1 };
      const result = await uploadToIPFS(data);
      assert.ok(result.cid, 'must have cid');
      assert.ok(result.contentHash, 'must have contentHash');
      assert.strictEqual(result.contentHash, canonicalHash(data));
    });

    await test('upload same data twice returns same contentHash', async () => {
      const data = { stable: 'content', version: 2 };
      const r1 = await uploadToIPFS(data);
      const r2 = await uploadToIPFS(data);
      assert.strictEqual(r1.contentHash, r2.contentHash);
    });

    await test('different data produces different contentHash', async () => {
      const r1 = await uploadToIPFS({ id: 1 });
      const r2 = await uploadToIPFS({ id: 2 });
      assert.notStrictEqual(r1.contentHash, r2.contentHash);
    });

    await test('state binding validation rejects hash mismatch', async () => {
      const data = { asset: 'test' };
      const fakeLeafHash = 'fake'.repeat(16);
      const result = validateStateBinding(data, fakeLeafHash);
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('STATE_BINDING'));
    });
  });
};
