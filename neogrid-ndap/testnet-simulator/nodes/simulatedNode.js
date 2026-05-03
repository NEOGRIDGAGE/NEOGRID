const path = require('path');
const { generateIdentity } = require(path.join(__dirname, '../../src/consensus/identity'));
const { ValidatorSet }     = require(path.join(__dirname, '../../src/consensus/validator'));
const { BFTConsensus }     = require(path.join(__dirname, '../../src/consensus/bft'));

class SimulatedNode {
  constructor({ nodeIndex, validators = null, timeout = 5000 }) {
    this.nodeIndex = nodeIndex;
    this.identity  = generateIdentity();
    this.nodeId    = this.identity.nodeId;
    this.finalized = [];
    this._emulator = null;
    this._log      = [];
    this._byzantine = false;

    this.validators = validators || new ValidatorSet();

    this.bft = new BFTConsensus({
      identity:   this.identity,
      validators: this.validators,
      timeout,
    });

    this.bft.on('broadcast', (msg) => {
      if (this._emulator) this._emulator.route(this.nodeId, msg);
    });

    this.bft.on('finalized', (state) => {
      this.finalized.push(state);
      this._log.push({ event: 'finalized', state });
    });

    this.bft.on('viewChange', (info) => {
      this._log.push({ event: 'viewChange', info });
    });
  }

  attachEmulator(emulator) {
    this._emulator = emulator;
  }

  sendMessage(msg) {
    if (this._emulator) this._emulator.route(this.nodeId, msg);
  }

  receiveMessage(msg) {
    this._log.push({ event: 'recv', type: msg.type });
    switch (msg.type) {
      case 'STATE_PROPOSE':  this.bft.handlePropose(msg);   break;
      case 'VOTE_PREVOTE':   this.bft.handlePrevote(msg);   break;
      case 'VOTE_PRECOMMIT': this.bft.handlePrecommit(msg); break;
      case 'VIEW_CHANGE':    this.bft.handleViewChange(msg); break;
      case 'FINALIZED_STATE': break;
      default: break;
    }
  }

  proposeState(smtRoot, mmrRoot) {
    return this.bft.startRound(smtRoot, mmrRoot);
  }

  vote(type, stateRoot) {
    // votes are cast automatically inside BFT on prevote/precommit quorum
    return null;
  }

  finalize() {
    return this.bft.getLatestFinalized();
  }

  height()         { return this.bft.height(); }
  phase()          { return this.bft.phase(); }
  getLog()         { return this._log; }
  isByzantine()    { return this._byzantine; }
  markByzantine()  { this._byzantine = true; }
}

module.exports = { SimulatedNode };