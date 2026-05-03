class ConsensusMetrics {
  constructor() {
    this.startTimes = new Map();
    this.finalityTimes = [];
    this.voteConvergenceRate = 0;
    this.viewChanges = 0;
    this.failedQuorumAttempts = 0;
  }

  start(height) {
    this.startTimes.set(height, Date.now());
  }

  finalize(height) {
    const started = this.startTimes.get(height);
    if (started) {
      this.finalityTimes.push(Date.now() - started);
    }
  }

  recordViewChange() {
    this.viewChanges++;
  }

  recordFailedQuorum() {
    this.failedQuorumAttempts++;
  }

  snapshot() {
    return {
      timeToFinality: this.finalityTimes,
      voteConvergenceRate: this.voteConvergenceRate,
      viewChangeFrequency: this.viewChanges,
      failedQuorumAttempts: this.failedQuorumAttempts,
    };
  }
}

module.exports = { ConsensusMetrics };
