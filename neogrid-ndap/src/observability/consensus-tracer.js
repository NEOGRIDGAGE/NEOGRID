class ConsensusTracer {
  constructor() {
    this.transitions = [];
    this.votes = [];
  }

  logPhaseTransition(height, from, to) {
    this.transitions.push({ height, from, to, timestamp: Date.now() });
  }

  logVote(height, type, nodeId, stateRoot) {
    this.votes.push({ height, type, nodeId, stateRoot, timestamp: Date.now() });
  }

  getVoteLineage(height) {
    return this.votes.filter(v => v.height === height);
  }
}

module.exports = { ConsensusTracer };
