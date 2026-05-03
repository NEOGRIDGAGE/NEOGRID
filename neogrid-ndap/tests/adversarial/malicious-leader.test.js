const { generateIdentity } = require('../../src/consensus/identity');
const { ValidatorSet } = require('../../src/consensus/validator');
const { BFTConsensus } = require('../../src/consensus/bft');

module.exports = async function(test, suite, assert) {
  await suite('Adversarial — malicious leader', async () => {
    await test('conflicting proposals are rejected at the same height', async () => {
      const id = generateIdentity();
      const vs = new ValidatorSet();
      vs.addValidator({ nodeId: id.nodeId, stake: 100, reputation: 1, pubKeyHex: id.pubKeyHex });
      const bft = new BFTConsensus({ identity: id, validators: vs, timeout: 1000 });
      const first = bft.startRound('root-a', 'mmr-a');
      assert.ok(first);
      bft._height = 0;
      bft._phase = 'IDLE';
      const second = bft.handlePropose({
        type: 'STATE_PROPOSE',
        height: 0,
        view: 0,
        proposerId: id.nodeId,
        stateRoot: 'root-b',
        smtRoot: 'root-b',
        mmrRoot: 'mmr-b',
        timestamp: Date.now(),
        signature: first ? first.commitCert[0].signature : null,
      });
      assert.strictEqual(second, null);
      assert.strictEqual(bft.getLatestFinalized().stateRoot, 'root-a');
    });
  });
};