class AdaptiveByzantineAdversary {
  constructor({ nodeId, rng = Math.random } = {}) {
    this.nodeId = nodeId;
    this.rng = rng;
    this.history = [];
  }

  observe(roundState) {
    this.history.push({ ...roundState, observedAt: Date.now() });
  }

  chooseAttack(roundState) {
    const leaderTargeted = roundState.leaderId === this.nodeId;
    const quorumTight = roundState.quorumMargin <= 1;
    const latencyHigh = roundState.avgLatencyMs >= 250;
    const partitioned = roundState.partitioned;

    if (leaderTargeted && quorumTight) return 'dynamic_leader_targeting';
    if (partitioned && quorumTight) return 'quorum_disruption';
    if (latencyHigh) return 'timing_equivocation';
    if (roundState.votePressure >= 2) return 'selective_suppression';
    return 'delayed_vote_injection';
  }

  act(roundState) {
    const strategy = this.chooseAttack(roundState);
    return {
      strategy,
      target: roundState.leaderId,
      suppress: strategy === 'selective_suppression',
      delayVotes: strategy === 'delayed_vote_injection' || strategy === 'timing_equivocation',
      equivocate: strategy === 'timing_equivocation' || strategy === 'quorum_disruption',
      disruptQuorum: strategy === 'quorum_disruption',
    };
  }
}

module.exports = { AdaptiveByzantineAdversary };