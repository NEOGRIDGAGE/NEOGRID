const { Engine } = require('../src/engine');
const { hashData } = require('../src/utils');

module.exports = async function(test, suite, assert) {
  await suite('Engine — authoritative state machine', async () => {

    const makeTx = (overrides = {}) => ({
      fromDID: 'did:neogrid:alice',
      toDID: 'did:neogrid:bob',
      assetId: hashData('asset-' + Math.random()),
      amount: 0,
      nonce: 'nonce-' + Math.random(),
      timestamp: Date.now(),
      ...overrides,
    });

    await test('state root changes after apply_transaction', async () => {
      const engine = new Engine();
      const r0 = engine.compute_state_root();
      const { createTransaction } = require('../src/tx');
      const tx = createTransaction(makeTx());
      engine.apply_transaction(tx);
      const r1 = engine.compute_state_root();
      assert.notStrictEqual(r0, r1);
    });

    await test('nonce replay is rejected', async () => {
      const engine = new Engine();
      const { createTransaction } = require('../src/tx');
      const assetId = hashData('unique-asset');
      const tx1 = createTransaction(makeTx({ assetId, nonce: 'fixed-nonce' }));
      engine.apply_transaction(tx1);
      const tx2 = createTransaction({ ...makeTx(), nonce: 'fixed-nonce', fromDID: 'did:neogrid:bob', toDID: 'did:neogrid:carol', assetId });
      assert.throws(() => engine.apply_transaction(tx2), /Replay|nonce/i);
    });

    await test('ownership violation is rejected', async () => {
      const engine = new Engine();
      const { createTransaction } = require('../src/tx');
      const assetId = hashData('owned-asset');
      const tx1 = createTransaction(makeTx({ assetId, nonce: 'n1' }));
      engine.apply_transaction(tx1);
      const tx2 = createTransaction({
        fromDID: 'did:neogrid:charlie',
        toDID: 'did:neogrid:dave',
        assetId,
        nonce: 'n2',
        timestamp: Date.now(),
        amount: 0,
      });
      assert.throws(() => engine.apply_transaction(tx2), /Ownership|owned/i);
    });

    await test('register_asset returns valid cid and root', async () => {
      const engine = new Engine();
      const result = await engine.register_asset('asset-reg-1', 'did:neogrid:alice', { name: 'test' });
      assert.ok(result.cid, 'must have cid');
      assert.ok(result.root, 'must have state root');
      assert.strictEqual(result.logEntry.index, 0);
    });

    await test('get_proof returns valid proof for registered asset', async () => {
      const engine = new Engine();
      const assetId = hashData('proof-asset');
      await engine.register_asset(assetId, 'alice', { x: 1 });
      const proof = engine.get_proof(assetId);
      assert.strictEqual(proof.exists, true);
      assert.strictEqual(engine.verify_proof(proof), true);
    });

    await test('state root equals SMT root (StateConsistency invariant)', async () => {
      const engine = new Engine();
      const { createTransaction } = require('../src/tx');
      const tx = createTransaction(makeTx({ nonce: 'n-consistency' }));
      const transition = engine.apply_transaction(tx);
      assert.strictEqual(transition.newRoot, engine.compute_state_root());
    });

    await test('log integrity verified after multiple transactions', async () => {
      const engine = new Engine();
      const { createTransaction } = require('../src/tx');
      for (let i = 0; i < 5; i++) {
        const tx = createTransaction(makeTx({ nonce: `n-log-${i}` }));
        engine.apply_transaction(tx);
      }
      const integrity = engine.verify_log_integrity();
      assert.strictEqual(integrity.valid, true);
    });

    await test('snapshot returns correct metadata', async () => {
      const engine = new Engine();
      const snap = engine.snapshot();
      assert.ok(typeof snap.stateRoot === 'string');
      assert.ok(typeof snap.mmrRoot === 'string');
      assert.strictEqual(snap.logSize, 0);
    });

    await test('Rust engine availability check does not throw', async () => {
      const engine = new Engine();
      assert.strictEqual(typeof engine.rustAvailable(), 'boolean');
    });
  });
};
