const EventEmitter = require('events');
const { signData, verifyData } = require('./identity');

const PHASE = {
  IDLE:          'IDLE',
  PROPOSING:     'PROPOSING',
  PREVOTING:     'PREVOTING',
  PRECOMMITTING: 'PRECOMMITTING',
  FINALIZED:     'FINALIZED',
  VIEW_CHANGE:   'VIEW_CHANGE',
};

class BFTConsensus extends EventEmitter {
  constructor({ identity, validators, timeout = 10000 }) {
    super();
    this._identity   = identity;
    this._validators = validators;
    this._timeout    = timeout;

    this._height    = 0;
    this._view      = 0;
    this._phase     = PHASE.IDLE;
    this._proposal  = null;
    this._prevotes  = new Map();
    this._precommits = new Map();
    this._finalized  = [];
    this._timer      = null;
  }

  height()  { return this._height; }
  view()    { return this._view; }
  phase()   { return this._phase; }

  // Start a new consensus round as leader (or wait for proposal if follower).
  // Returns finalState synchronously when single-node quorum is met, else null.
  startRound(smtRoot, mmrRoot) {
    this._clearTimer();
    this._prevotes.clear();
    this._precommits.clear();
    this._proposal = null;

    const leader   = this._validators.getLeader(this._height, this._view);
    const isLeader = leader === this._identity.nodeId;

    if (!isLeader) {
      this._phase = PHASE.PREVOTING;
      this._startTimer();
      return null;
    }

    const proposal = this._createProposal(smtRoot, mmrRoot);
    this._phase    = PHASE.PROPOSING;
    this.emit('broadcast', proposal);
    return this._processProposal(proposal);
  }

  // Handle incoming STATE_PROPOSE from a peer.
  handlePropose(proposal) {
    if (proposal.height !== this._height || proposal.view !== this._view) return null;
    const expected = this._validators.getLeader(this._height, this._view);
    if (proposal.proposerId !== expected) return null;
    const v = this._validators.get(proposal.proposerId);
    if (!v || !verifyData(v.pubKeyHex, this._signableProposal(proposal), proposal.signature)) return null;
    return this._processProposal(proposal);
  }

  // Handle incoming VOTE_PREVOTE from a peer.
  handlePrevote(vote) {
    return this._handleVote('prevote', vote, this._prevotes);
  }

  // Handle incoming VOTE_PRECOMMIT from a peer.
  handlePrecommit(vote) {
    return this._handleVote('precommit', vote, this._precommits);
  }

  // Handle VIEW_CHANGE message (leader may need to act as new leader).
  handleViewChange(msg) {
    if (msg.height !== this._height || msg.view < this._view) return;
    if (msg.view > this._view) {
      this._view    = msg.view;
      this._phase   = PHASE.VIEW_CHANGE;
      this._proposal = null;
      this._prevotes.clear();
      this._precommits.clear();
      this._clearTimer();
      this.emit('viewChange', { height: this._height, view: this._view, reason: 'peer' });
    }
  }

  // Trigger view-change locally (e.g. on timeout).
  triggerViewChange(reason = 'timeout') {
    this._clearTimer();
    this._view++;
    this._phase     = PHASE.VIEW_CHANGE;
    this._proposal  = null;
    this._prevotes.clear();
    this._precommits.clear();

    const msg = {
      type:      'VIEW_CHANGE',
      height:    this._height,
      view:      this._view,
      nodeId:    this._identity.nodeId,
      reason,
      timestamp: Date.now(),
    };
    msg.signature = this._sign(`viewchange:${msg.height}:${msg.view}:${msg.nodeId}`);
    this.emit('broadcast', msg);
    this.emit('viewChange', { height: this._height, view: this._view, reason });
    return msg;
  }

  getFinalizedState(height) { return this._finalized[height] || null; }
  getLatestFinalized()      { return this._finalized[this._finalized.length - 1] || null; }

  // ── private ────────────────────────────────────────────────────────────────

  _processProposal(proposal) {
    this._proposal = proposal;
    this._phase    = PHASE.PREVOTING;
    this._startTimer();

    const prevote = this._createVote('VOTE_PREVOTE');
    this.emit('broadcast', prevote);
    return this._handleVote('prevote', prevote, this._prevotes);
  }

  _handleVote(type, vote, store) {
    if (vote.height !== this._height) return null;
    if (!this._proposal || vote.stateRoot !== this._proposal.stateRoot) return null;

    const v = this._validators.get(vote.nodeId);
    if (!v || !verifyData(v.pubKeyHex, this._signableVote(vote), vote.signature)) return null;

    store.set(vote.nodeId, vote);

    if (!this._validators.hasQuorum(Array.from(store.keys()))) return null;

    if (type === 'prevote' && this._phase === PHASE.PREVOTING) {
      this._phase = PHASE.PRECOMMITTING;
      const precommit = this._createVote('VOTE_PRECOMMIT');
      this.emit('broadcast', precommit);
      return this._handleVote('precommit', precommit, this._precommits);
    }

    if (type === 'precommit' && this._phase === PHASE.PRECOMMITTING) {
      return this._finalize();
    }

    return null;
  }

  _finalize() {
    this._clearTimer();
    this._phase = PHASE.FINALIZED;

    const commitCert = Array.from(this._precommits.values())
      .map(v => ({ nodeId: v.nodeId, signature: v.signature }));

    const state = {
      height:      this._height,
      view:        this._view,
      stateRoot:   this._proposal.stateRoot,
      smtRoot:     this._proposal.smtRoot,
      mmrRoot:     this._proposal.mmrRoot,
      commitCert,
      finalized:   true,
      finalizedAt: Date.now(),
    };

    this._finalized.push(state);
    this.emit('finalized', state);

    const msg = {
      type:      'FINALIZED_STATE',
      nodeId:    this._identity.nodeId,
      timestamp: state.finalizedAt,
      payload:   state,
    };
    msg.signature = this._sign(`finalized:${state.height}:${state.stateRoot}`);
    this.emit('broadcast', msg);

    this._height++;
    this._view      = 0;
    this._phase     = PHASE.IDLE;
    this._proposal  = null;
    this._prevotes.clear();
    this._precommits.clear();

    return state;
  }

  _createProposal(smtRoot, mmrRoot) {
    const p = {
      type:        'STATE_PROPOSE',
      height:      this._height,
      view:        this._view,
      proposerId:  this._identity.nodeId,
      stateRoot:   smtRoot,
      smtRoot,
      mmrRoot,
      timestamp:   Date.now(),
    };
    p.signature = this._sign(this._signableProposal(p));
    return p;
  }

  _createVote(type) {
    const v = {
      type,
      height:     this._height,
      view:       this._view,
      nodeId:     this._identity.nodeId,
      stateRoot:  this._proposal ? this._proposal.stateRoot : null,
      smtRoot:    this._proposal ? this._proposal.smtRoot   : null,
      mmrRoot:    this._proposal ? this._proposal.mmrRoot   : null,
      timestamp:  Date.now(),
    };
    v.signature = this._sign(this._signableVote(v));
    return v;
  }

  _signableProposal(p) {
    return `proposal:${p.height}:${p.view}:${p.proposerId}:${p.stateRoot}`;
  }

  _signableVote(v) {
    return `vote:${v.type}:${v.height}:${v.view}:${v.nodeId}:${v.stateRoot}`;
  }

  _sign(str) { return signData(this._identity.privateKey, str); }

  _startTimer() {
    this._clearTimer();
    this._timer = setTimeout(() => this.triggerViewChange('timeout'), this._timeout);
  }

  _clearTimer() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}

module.exports = { BFTConsensus, PHASE };
