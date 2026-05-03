const version = require('../src/core/version');
const { computeCoreHash } = require('../src/core/core-hash');
const { assertConsensusSafetyEnforcement } = require('../src/core/consensusIntegrityGuard');
const { ValidatorSet } = require('../src/consensus/validator');
const { generateIdentity } = require('../src/consensus/identity');
const { BFTConsensus } = require('../src/consensus/bft');

module.exports = async function(test, suite, assert) {
  await suite('Protocol freeze', async () => {
    await test('version snapshot is STABLE 1.0.0', async () => {
      assert.strictEqual(version.protocolName, 'NDAP');
      assert.strictEqual(version.version, '1.0.0');
      assert.strictEqual(version.status, 'STABLE');
    });

    await test('core hash snapshot is stable in-process', async () => {
      const a = computeCoreHash();
      const b = computeCoreHash();
      assert.deepStrictEqual(a, b);
    });

    await test('consensus safety enforcement does not throw on locked core', async () => {
      assert.doesNotThrow(() => assertConsensusSafetyEnforcement());
    });

    await test('validator logic remains identical across runs', async () => {
      const id = generateIdentity();
      const vs1 = new ValidatorSet();
      const vs2 = new ValidatorSet();
      [vs1, vs2].forEach((vs) => vs.addValidator({ nodeId: id.nodeId, stake: 100, reputation: 1, pubKeyHex: id.pubKeyHex }));
      assert.strictEqual(vs1.quorumThreshold(), vs2.quorumThreshold());
      assert.strictEqual(vs1.getLeader(0, 0), vs2.getLeader(0, 0));
    });

    await test('state transitions remain deterministic', async () => {
      const id = generateIdentity();
      const vs1 = new ValidatorSet();
      const vs2 = new ValidatorSet();
      vs1.addValidator({ nodeId: id.nodeId, stake: 100, reputation: 1, pubKeyHex: id.pubKeyHex });
      vs2.addValidator({ nodeId: id.nodeId, stake: 100, reputation: 1, pubKeyHex: id.pubKeyHex });
      const a = new BFTConsensus({ identity: id, validators: vs1, timeout: 1000 });
      const b = new BFTConsensus({ identity: id, validators: vs2, timeout: 1000 });
      assert.strictEqual(a.startRound('root-a', 'mmr-a').stateRoot, b.startRound('root-a', 'mmr-a').stateRoot);
      assert.strictEqual(a.phase(), b.phase());
      assert.strictEqual(a.height(), b.height());
    });
  });
};