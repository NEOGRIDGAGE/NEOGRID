const { generateWitness, generateProof, verifyProof, zkPipeline } = require('../src/zk');

module.exports = async function(test, suite, assert) {
  await suite('ZK Pipeline — proof generation and verification', async () => {

    const makeTx = () => ({
      fromDID: 'did:neogrid:alice',
      toDID: 'did:neogrid:bob',
      assetId: 'asset-001',
      amount: 10,
      nonce: 'nonce-' + Date.now() + Math.random(),
      timestamp: Date.now(),
    });

    await test('witness valid=1 when balance >= amount', async () => {
      const tx = makeTx();
      const witness = generateWitness(tx, 100);
      assert.strictEqual(witness.valid, 1);
      assert.strictEqual(witness.balance, 100);
      assert.strictEqual(witness.amount, 10);
    });

    await test('witness valid=0 when balance < amount', async () => {
      const tx = makeTx();
      const witness = generateWitness(tx, 5);
      assert.strictEqual(witness.valid, 0);
    });

    await test('proof generation succeeds for valid witness', async () => {
      const tx = makeTx();
      const witness = generateWitness(tx, 50);
      const proof = generateProof(witness);
      assert.strictEqual(proof.ok, true);
      assert.ok(proof.proof, 'must have proof string');
    });

    await test('proof generation fails for invalid witness', async () => {
      const tx = makeTx();
      const witness = generateWitness(tx, 5);
      const proof = generateProof(witness);
      assert.strictEqual(proof.ok, false);
      assert.ok(proof.error);
    });

    await test('verifyProof succeeds for fresh valid proof', async () => {
      const tx = makeTx();
      const witness = generateWitness(tx, 100);
      const proof = generateProof(witness);
      const result = verifyProof(proof, proof.publicInputs);
      assert.strictEqual(result.valid, true);
    });

    await test('verifyProof rejects proof with wrong txHash in publicInputs', async () => {
      const tx = makeTx();
      const witness = generateWitness(tx, 100);
      const proof = generateProof(witness);
      const result = verifyProof(proof, { txHash: 'wrong-hash' });
      assert.strictEqual(result.valid, false);
    });

    await test('zkPipeline returns ok=true for sufficient balance', async () => {
      const tx = makeTx();
      const result = zkPipeline(tx, 1000);
      assert.strictEqual(result.ok, true);
    });

    await test('zkPipeline returns ok=false for insufficient balance', async () => {
      const tx = makeTx();
      const result = zkPipeline(tx, 1);
      assert.strictEqual(result.ok, false);
      assert.ok(result.error);
    });
  });
};
