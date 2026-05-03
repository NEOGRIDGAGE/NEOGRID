const path = require('path');
const { SimulatedNode } = require(path.join(__dirname, '../nodes/simulatedNode'));
const { generateIdentity, signData } = require(path.join(__dirname, '../../src/consensus/identity'));

class ByzantineActor extends SimulatedNode {
  constructor(opts) {
    super(opts);
    this.markByzantine();
    this._msgHistory = [];
  }

  // ── Byzantine capabilities ───────────────────────────────────────────────────

  // Send two conflicting proposals for the same height
  sendConflictingProposals(smtRootA, smtRootB) {
    const height = this.bft.height();
    const view   = this.bft.view();
    const base   = {
      type:       'STATE_PROPOSE',
      height,
      view,
      proposerId: this.nodeId,
      timestamp:  Date.now(),
    };
    const propA = { ...base, stateRoot: smtRootA, smtRoot: smtRootA, mmrRoot: 'mmr-evil-a' };
    const propB = { ...base, stateRoot: smtRootB, smtRoot: smtRootB, mmrRoot: 'mmr-evil-b' };
    propA.signature = signData(this.identity.privateKey, `proposal:${height}:${view}:${this.nodeId}:${smtRootA}`);
    propB.signature = signData(this.identity.privateKey, `proposal:${height}:${view}:${this.nodeId}:${smtRootB}`);
    if (this._emulator) {
      this._emulator.route(this.nodeId, propA);
      this._emulator.route(this.nodeId, propB);
    }
    return [propA, propB];
  }

  // Cast the same prevote for two different state roots (equivocation)
  doubleVote(stateRootA, stateRootB) {
    const height = this.bft.height();
    const view   = this.bft.view();
    const mkVote = (root) => {
      const v = {
        type:      'VOTE_PREVOTE',
        height,
        view,
        nodeId:    this.nodeId,
        stateRoot: root,
        smtRoot:   root,
        mmrRoot:   'mmr-double',
        timestamp: Date.now(),
      };
      v.signature = signData(this.identity.privateKey, `vote:VOTE_PREVOTE:${height}:${view}:${this.nodeId}:${root}`);
      return v;
    };
    const va = mkVote(stateRootA);
    const vb = mkVote(stateRootB);
    if (this._emulator) {
      this._emulator.route(this.nodeId, va);
      this._emulator.route(this.nodeId, vb);
    }
    return [va, vb];
  }

  // Re-broadcast an old message
  replayMessage(msg) {
    if (this._emulator) this._emulator.route(this.nodeId, { ...msg, timestamp: Date.now() });
  }

  // Broadcast a fake stateRoot (signature will be valid but root is fabricated)
  fakeBroadcast(fakeRoot) {
    const height = this.bft.height();
    const view   = this.bft.view();
    const msg = {
      type:      'STATE_PROPOSE',
      height,
      view,
      proposerId: this.nodeId,
      stateRoot:  fakeRoot,
      smtRoot:    fakeRoot,
      mmrRoot:    fakeRoot,
      timestamp:  Date.now(),
    };
    msg.signature = signData(this.identity.privateKey, `proposal:${height}:${view}:${this.nodeId}:${fakeRoot}`);
    if (this._emulator) this._emulator.route(this.nodeId, msg);
    return msg;
  }

  // Impersonation: fabricate a message pretending to be another nodeId.
  // NDAP will reject it because the signature won't verify against the target's pubKey.
  impersonate(targetNodeId, stateRoot) {
    const height = this.bft.height();
    const view   = this.bft.view();
    const msg = {
      type:      'STATE_PROPOSE',
      height,
      view,
      proposerId: targetNodeId,               // lie about identity
      stateRoot,
      smtRoot:    stateRoot,
      mmrRoot:    'mmr-impersonation',
      timestamp:  Date.now(),
      signature:  signData(this.identity.privateKey, `proposal:${height}:${view}:${targetNodeId}:${stateRoot}`),
    };
    if (this._emulator) this._emulator.route(this.nodeId, msg);
    return msg;
  }

  storeMessage(msg) {
    this._msgHistory.push({ ...msg, _storedAt: Date.now() });
  }

  oldestStoredMessage() {
    return this._msgHistory[0] || null;
  }
}

module.exports = { ByzantineActor };