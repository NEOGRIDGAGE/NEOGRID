const { BinarySMT, EMPTY_HASH, leafHash, nodeHash } = require('../src/smt');
const { hashData } = require('../src/utils');

module.exports = async function(test, suite, assert) {
  await suite('BinarySMT — inclusion proofs', async () => {

    await test('empty tree root is EMPTY_HASH', async () => {
      const smt = new BinarySMT();
      assert.strictEqual(smt.computeRoot(), EMPTY_HASH);
    });

    await test('root changes after insert', async () => {
      const smt = new BinarySMT();
      const r0 = smt.computeRoot();
      smt.set(hashData('key1'), 'value1');
      assert.notStrictEqual(smt.computeRoot(), r0);
    });

    await test('inclusion proof verifies for existing key', async () => {
      const smt = new BinarySMT();
      const key = hashData('asset-alice');
      smt.set(key, 'alice');
      const proof = smt.getProof(key);
      assert.strictEqual(proof.exists, true);
      assert.strictEqual(proof.value, 'alice');
      assert.strictEqual(smt.verifyProof(proof), true);
    });

    await test('non-membership proof verifies for absent key', async () => {
      const smt = new BinarySMT();
      const key1 = hashData('key-present');
      const key2 = hashData('key-absent');
      smt.set(key1, 'present');
      const proof = smt.getProof(key2);
      assert.strictEqual(proof.exists, false);
      assert.strictEqual(smt.verifyProof(proof), true);
    });

    await test('proof root matches computeRoot', async () => {
      const smt = new BinarySMT();
      smt.set(hashData('a'), 'val-a');
      smt.set(hashData('b'), 'val-b');
      const key = hashData('a');
      const proof = smt.getProof(key);
      assert.strictEqual(proof.root, smt.computeRoot());
    });

    await test('each new key produces unique root', async () => {
      const smt = new BinarySMT();
      const roots = new Set();
      roots.add(smt.computeRoot());
      for (let i = 0; i < 5; i++) {
        smt.set(hashData(`key-${i}`), `val-${i}`);
        roots.add(smt.computeRoot());
      }
      assert.strictEqual(roots.size, 6);
    });

    await test('updating a value changes root', async () => {
      const smt = new BinarySMT();
      const key = hashData('mutable');
      smt.set(key, 'v1');
      const r1 = smt.computeRoot();
      smt.set(key, 'v2');
      const r2 = smt.computeRoot();
      assert.notStrictEqual(r1, r2);
      assert.strictEqual(smt.get(key), 'v2');
    });

    await test('tampered proof root fails verification', async () => {
      const smt = new BinarySMT();
      const key = hashData('tamper-test');
      smt.set(key, 'original');
      const proof = smt.getProof(key);
      const tamperedProof = { ...proof, root: hashData('fake-root') };
      assert.strictEqual(smt.verifyProof(tamperedProof), false);
    });

    await test('proof with wrong value fails verification', async () => {
      const smt = new BinarySMT();
      const key = hashData('value-test');
      smt.set(key, 'real-value');
      const proof = smt.getProof(key);
      const tamperedProof = { ...proof, value: 'fake-value' };
      assert.strictEqual(smt.verifyProof(tamperedProof), false);
    });

    await test('many keys — all proofs valid', async () => {
      const smt = new BinarySMT();
      const keys = [];
      for (let i = 0; i < 20; i++) {
        const k = hashData(`bulk-key-${i}`);
        smt.set(k, `owner-${i}`);
        keys.push(k);
      }
      for (const k of keys) {
        const proof = smt.getProof(k);
        assert.strictEqual(proof.exists, true, `Key ${k} should exist`);
        assert.strictEqual(smt.verifyProof(proof), true, `Proof for ${k} should verify`);
      }
    });
  });
};
