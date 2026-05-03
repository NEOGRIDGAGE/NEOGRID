const { assertNoDoubleFinalization, assertSMTMatchesMMR, assertValidQuorum, assertValidStateTransition, assertValidatorSetConsistency } = require('../src/core/invariants');

module.exports = async function(test, suite, assert) {
  await suite('Invariants', async () => {
    await test('no double finalization rejects conflicting roots', async () => {
      const map = new Map([[1, 'a']]);
      assert.throws(() => assertNoDoubleFinalization(1, 'b', map), /DOUBLE_FINALIZATION/);
    });
    await test('SMT must match MMR state', async () => {
      assert.throws(() => assertSMTMatchesMMR({ stateRoot: 'a', smtRoot: 'b', mmrRoot: 'x' }), /SMT_MMR_MISMATCH/);
    });
    await test('quorum validation rejects low weight', async () => {
      assert.throws(() => assertValidQuorum([{ weight: 1 }], 10), /INSUFFICIENT_QUORUM/);
    });
    await test('state transitions are enforced', async () => {
      assert.throws(() => assertValidStateTransition('IDLE', 'FINALIZED'), /INVALID_STATE_TRANSITION/);
    });
    await test('validator set consistency snapshots', async () => {
      const snap = new Map();
      const hash = assertValidatorSetConsistency(1, [{ nodeId: 'a', weight: 1, pubKeyHex: 'p' }], snap);
      assert.strictEqual(typeof hash, 'string');
      assert.throws(() => assertValidatorSetConsistency(1, [{ nodeId: 'a', weight: 2, pubKeyHex: 'p' }], snap), /VALIDATOR_SET_INCONSISTENT/);
    });
  });
};
