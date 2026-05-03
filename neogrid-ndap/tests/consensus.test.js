const { generateIdentity, signData, verifyData } = require('../src/consensus/identity');
const { ValidatorSet }                           = require('../src/consensus/validator');
const { BFTConsensus, PHASE }                    = require('../src/consensus/bft');

module.exports = async function(test, suite, assert) {

  // ── Identity ────────────────────────────────────────────────────────────────

  await suite('Consensus — Ed25519 identity', async () => {

    await test('generateIdentity returns nodeId, pubKeyHex, privateKey', async () => {
      const id = generateIdentity();
      assert.ok(id.nodeId, 'nodeId must be set');
      assert.ok(id.pubKeyHex, 'pubKeyHex must be set');
      assert.ok(id.privateKey, 'privateKey must be set');
      assert.strictEqual(typeof id.nodeId, 'string');
      assert.ok(id.nodeId.length === 64, 'nodeId is 64-char hex SHA-256');
    });

    await test('two identities produce different nodeIds', async () => {
      const a = generateIdentity();
      const b = generateIdentity();
      assert.notStrictEqual(a.nodeId, b.nodeId);
      assert.notStrictEqual(a.pubKeyHex, b.pubKeyHex);
    });

    await test('sign and verify round-trip succeeds', async () => {
      const id  = generateIdentity();
      const sig = signData(id.privateKey, 'hello NDAP');
      assert.strictEqual(verifyData(id.pubKeyHex, 'hello NDAP', sig), true);
    });

    await test('sign is deterministic for same input', async () => {
      const id = generateIdentity();
      assert.strictEqual(signData(id.privateKey, 'msg'), signData(id.privateKey, 'msg'));
    });

    await test('verify fails with wrong public key', async () => {
      const a = generateIdentity();
      const b = generateIdentity();
      const sig = signData(a.privateKey, 'hello');
      assert.strictEqual(verifyData(b.pubKeyHex, 'hello', sig), false);
    });

    await test('verify fails with tampered data', async () => {
      const id  = generateIdentity();
      const sig = signData(id.privateKey, 'original');
      assert.strictEqual(verifyData(id.pubKeyHex, 'tampered', sig), false);
    });

    await test('verify fails with truncated signature', async () => {
      const id  = generateIdentity();
      const sig = signData(id.privateKey, 'data');
      assert.strictEqual(verifyData(id.pubKeyHex, 'data', sig.slice(0, -4)), false);
    });

  });

  // ── ValidatorSet ────────────────────────────────────────────────────────────

  await suite('Consensus — ValidatorSet', async () => {

    function v(id, stake, rep) {
      return { nodeId: id, stake, reputation: rep, pubKeyHex: 'dead' + id };
    }

    await test('addValidator stores weight = stake × reputation', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 100, 1));
      assert.strictEqual(vs.get('n1').weight, 100);
    });

    await test('totalWeight sums all validator weights', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 100, 1));
      vs.addValidator(v('n2', 200, 0.5));
      assert.strictEqual(vs.totalWeight(), 200);
    });

    await test('quorumThreshold is exactly 2/3 of total weight', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 300, 1));
      assert.ok(Math.abs(vs.quorumThreshold() - 200) < 0.001);
    });

    await test('hasQuorum true when ≥ 2/3 weight votes', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 100, 1));
      vs.addValidator(v('n2', 100, 1));
      vs.addValidator(v('n3', 100, 1));
      assert.strictEqual(vs.hasQuorum(['n1', 'n2']), true);
    });

    await test('hasQuorum false when < 2/3 weight votes', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 100, 1));
      vs.addValidator(v('n2', 100, 1));
      vs.addValidator(v('n3', 100, 1));
      assert.strictEqual(vs.hasQuorum(['n1']), false);
    });

    await test('single validator always reaches quorum with own vote', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 100, 1));
      assert.strictEqual(vs.hasQuorum(['n1']), true);
    });

    await test('unknown nodeId contributes 0 weight', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 100, 1));
      vs.addValidator(v('n2', 1000, 1));
      assert.strictEqual(vs.hasQuorum(['ghost-id']), false);
    });

    await test('getLeader is deterministic: (height + view) mod count', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 1, 1));
      vs.addValidator(v('n2', 1, 1));
      const ids = ['n1', 'n2'].sort();
      assert.strictEqual(vs.getLeader(0, 0), ids[0]);
      assert.strictEqual(vs.getLeader(1, 0), ids[1]);
      assert.strictEqual(vs.getLeader(2, 0), ids[0]);
      assert.strictEqual(vs.getLeader(0, 1), ids[1]);
    });

    await test('removeValidator reduces count and total weight', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 100, 1));
      vs.addValidator(v('n2', 200, 1));
      vs.removeValidator('n1');
      assert.strictEqual(vs.count(), 1);
      assert.strictEqual(vs.totalWeight(), 200);
    });

    await test('getAll returns all validators with nodeId', async () => {
      const vs = new ValidatorSet();
      vs.addValidator(v('n1', 100, 1));
      const all = vs.getAll();
      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].nodeId, 'n1');
    });

  });

  // ── BFT — single-node (auto-finalize) ───────────────────────────────────────

  await suite('Consensus — BFT single-node (auto-finalize)', async () => {

    function makeSingle() {
      const id = generateIdentity();
      const vs = new ValidatorSet();
      vs.addValidator({ nodeId: id.nodeId, stake: 100, reputation: 1, pubKeyHex: id.pubKeyHex });
      const bft = new BFTConsensus({ identity: id, validators: vs, timeout: 60_000 });
      return { bft, id, vs };
    }

    await test('initial phase is IDLE', async () => {
      const { bft } = makeSingle();
      assert.strictEqual(bft.phase(), PHASE.IDLE);
    });

    await test('initial height is 0', async () => {
      const { bft } = makeSingle();
      assert.strictEqual(bft.height(), 0);
    });

    await test('startRound finalizes synchronously in single-node mode', async () => {
      const { bft } = makeSingle();
      const fs = bft.startRound('smt-root-1', 'mmr-root-1');
      assert.ok(fs, 'must return finalState');
      assert.strictEqual(fs.finalized, true);
      assert.strictEqual(fs.height, 0);
      assert.strictEqual(fs.smtRoot, 'smt-root-1');
      assert.strictEqual(fs.mmrRoot, 'mmr-root-1');
    });

    await test('height increments by 1 after each round', async () => {
      const { bft } = makeSingle();
      bft.startRound('r1', 'm1');
      assert.strictEqual(bft.height(), 1);
      bft.startRound('r2', 'm2');
      assert.strictEqual(bft.height(), 2);
    });

    await test('phase returns to IDLE after finalization', async () => {
      const { bft } = makeSingle();
      bft.startRound('r', 'm');
      assert.strictEqual(bft.phase(), PHASE.IDLE);
    });

    await test('commitCert contains own signature', async () => {
      const { bft, id } = makeSingle();
      const fs = bft.startRound('smt', 'mmr');
      assert.strictEqual(fs.commitCert.length, 1);
      assert.strictEqual(fs.commitCert[0].nodeId, id.nodeId);
      assert.ok(fs.commitCert[0].signature);
    });

    await test('finalized event emitted with correct state', async () => {
      const { bft } = makeSingle();
      let emitted = null;
      bft.on('finalized', s => { emitted = s; });
      bft.startRound('smt', 'mmr');
      assert.ok(emitted);
      assert.strictEqual(emitted.finalized, true);
      assert.strictEqual(emitted.smtRoot, 'smt');
    });

    await test('broadcast emits STATE_PROPOSE, VOTE_PREVOTE, VOTE_PRECOMMIT, FINALIZED_STATE', async () => {
      const { bft } = makeSingle();
      const types = [];
      bft.on('broadcast', m => types.push(m.type));
      bft.startRound('smt', 'mmr');
      assert.ok(types.includes('STATE_PROPOSE'));
      assert.ok(types.includes('VOTE_PREVOTE'));
      assert.ok(types.includes('VOTE_PRECOMMIT'));
      assert.ok(types.includes('FINALIZED_STATE'));
    });

    await test('getFinalizedState returns correct state by height', async () => {
      const { bft } = makeSingle();
      bft.startRound('smt-0', 'mmr-0');
      bft.startRound('smt-1', 'mmr-1');
      assert.strictEqual(bft.getFinalizedState(0).smtRoot, 'smt-0');
      assert.strictEqual(bft.getFinalizedState(1).smtRoot, 'smt-1');
    });

    await test('getLatestFinalized returns highest-height state', async () => {
      const { bft } = makeSingle();
      bft.startRound('smt-0', 'mmr-0');
      bft.startRound('smt-1', 'mmr-1');
      const latest = bft.getLatestFinalized();
      assert.strictEqual(latest.height, 1);
      assert.strictEqual(latest.smtRoot, 'smt-1');
    });

    await test('stateRoot in finalizedState equals smtRoot (proposal)', async () => {
      const { bft } = makeSingle();
      const fs = bft.startRound('smt-X', 'mmr-X');
      assert.strictEqual(fs.stateRoot, 'smt-X');
    });

    await test('finalizedState has finalized:true and finalizedAt timestamp', async () => {
      const { bft } = makeSingle();
      const before = Date.now();
      const fs = bft.startRound('smt', 'mmr');
      const after = Date.now();
      assert.strictEqual(fs.finalized, true);
      assert.ok(fs.finalizedAt >= before && fs.finalizedAt <= after);
    });

  });

  // ── BFT — view change ───────────────────────────────────────────────────────

  await suite('Consensus — BFT view change', async () => {

    function makeSingle() {
      const id = generateIdentity();
      const vs = new ValidatorSet();
      vs.addValidator({ nodeId: id.nodeId, stake: 100, reputation: 1, pubKeyHex: id.pubKeyHex });
      return new BFTConsensus({ identity: id, validators: vs, timeout: 60_000 });
    }

    await test('triggerViewChange increments view', async () => {
      const bft = makeSingle();
      bft._height = 3;
      bft._phase  = PHASE.PREVOTING;
      bft.triggerViewChange('test');
      assert.strictEqual(bft.view(), 1);
    });

    await test('triggerViewChange sets phase to VIEW_CHANGE', async () => {
      const bft = makeSingle();
      bft._height = 3;
      bft._phase  = PHASE.PREVOTING;
      bft.triggerViewChange('test');
      assert.strictEqual(bft.phase(), PHASE.VIEW_CHANGE);
    });

    await test('triggerViewChange emits VIEW_CHANGE broadcast', async () => {
      const bft = makeSingle();
      const types = [];
      bft.on('broadcast', m => types.push(m.type));
      bft._height = 3;
      bft._phase  = PHASE.PREVOTING;
      bft.triggerViewChange('timeout');
      assert.ok(types.includes('VIEW_CHANGE'));
    });

    await test('triggerViewChange emits viewChange event', async () => {
      const bft = makeSingle();
      let evt = null;
      bft.on('viewChange', e => { evt = e; });
      bft._height = 5;
      bft._phase  = PHASE.PREVOTING;
      bft.triggerViewChange('timeout');
      assert.ok(evt);
      assert.strictEqual(evt.height, 5);
      assert.strictEqual(evt.view, 1);
      assert.strictEqual(evt.reason, 'timeout');
    });

    await test('multiple view changes accumulate view number', async () => {
      const bft = makeSingle();
      bft._height = 2;
      bft._phase  = PHASE.PREVOTING;
      bft.triggerViewChange('t1');
      bft.triggerViewChange('t2');
      assert.strictEqual(bft.view(), 2);
    });

  });

  // ── BFT — three-node quorum simulation ──────────────────────────────────────

  await suite('Consensus — BFT three-node quorum', async () => {

    function makeThree() {
      const ids = [generateIdentity(), generateIdentity(), generateIdentity()];
      const vs  = new ValidatorSet();
      for (const id of ids) {
        vs.addValidator({ nodeId: id.nodeId, stake: 100, reputation: 1, pubKeyHex: id.pubKeyHex });
      }
      const bfts = ids.map(id => new BFTConsensus({ identity: id, validators: vs, timeout: 60_000 }));
      return { ids, vs, bfts };
    }

    await test('leader selection is (height+view) mod count', async () => {
      const { ids, vs } = makeThree();
      const sorted = ids.map(i => i.nodeId).sort();
      assert.strictEqual(vs.getLeader(0, 0), sorted[0]);
      assert.strictEqual(vs.getLeader(1, 0), sorted[1]);
      assert.strictEqual(vs.getLeader(2, 0), sorted[2]);
      assert.strictEqual(vs.getLeader(3, 0), sorted[0]);
    });

    await test('2/3 validators satisfy quorum, 1/3 does not', async () => {
      const { ids, vs } = makeThree();
      const nids = ids.map(i => i.nodeId);
      assert.strictEqual(vs.hasQuorum([nids[0], nids[1]]), true);
      assert.strictEqual(vs.hasQuorum([nids[0]]),           false);
    });

    await test('leader does not auto-finalize without peer votes', async () => {
      const { ids, vs, bfts } = makeThree();
      const sorted    = ids.map(i => i.nodeId).sort();
      const leaderIdx = ids.findIndex(i => i.nodeId === sorted[0]);
      const result    = bfts[leaderIdx].startRound('smtRoot', 'mmrRoot');
      assert.strictEqual(result, null);
      assert.strictEqual(bfts[leaderIdx].phase(), PHASE.PREVOTING);
    });

    await test('leader finalizes after 2nd validator prevote + precommit', async () => {
      const { ids, vs, bfts } = makeThree();
      const sorted    = ids.map(i => i.nodeId).sort();
      const leaderIdx = ids.findIndex(i => i.nodeId === sorted[0]);
      const follIdx   = ids.findIndex(i => i.nodeId === sorted[1]);
      const leaderBft = bfts[leaderIdx];
      const follBft   = bfts[follIdx];

      leaderBft.startRound('smtRoot', 'mmrRoot');

      follBft._height   = 0;
      follBft._view     = 0;
      follBft._proposal = leaderBft._proposal;
      follBft._phase    = PHASE.PREVOTING;

      const follPrevote = follBft._createVote('VOTE_PREVOTE');
      const midResult   = leaderBft.handlePrevote(follPrevote);
      assert.strictEqual(midResult, null);
      assert.strictEqual(leaderBft.phase(), PHASE.PRECOMMITTING);

      follBft._phase = PHASE.PRECOMMITTING;
      const follPrecommit = follBft._createVote('VOTE_PRECOMMIT');
      const finalState    = leaderBft.handlePrecommit(follPrecommit);

      assert.ok(finalState, 'must produce finalState');
      assert.strictEqual(finalState.finalized, true);
      assert.strictEqual(finalState.smtRoot, 'smtRoot');
      assert.strictEqual(finalState.commitCert.length, 2);
    });

    await test('votes from non-validator are rejected', async () => {
      const { ids, vs, bfts } = makeThree();
      const sorted    = ids.map(i => i.nodeId).sort();
      const leaderIdx = ids.findIndex(i => i.nodeId === sorted[0]);
      const leaderBft = bfts[leaderIdx];
      leaderBft.startRound('smtRoot', 'mmrRoot');

      const outsider = generateIdentity();
      const fakeVote = {
        type: 'VOTE_PREVOTE', height: 0, view: 0,
        nodeId: outsider.nodeId, stateRoot: 'smtRoot',
        smtRoot: 'smtRoot', mmrRoot: 'mmrRoot', timestamp: Date.now(),
      };
      fakeVote.signature = signData(outsider.privateKey,
        `vote:VOTE_PREVOTE:0:0:${outsider.nodeId}:smtRoot`);

      const r = leaderBft.handlePrevote(fakeVote);
      assert.strictEqual(r, null);
    });

  });

};
