class AdaptiveByzantineAdversary {
  constructor({ nodeId, seed = 0 } = {}) {
    this.nodeId = nodeId;
    this.seed = seed;
  }

  chooseAttack(roundState) {
    const score = (roundState.leaderId === this.nodeId ? 3 : 0)
      + (roundState.quorumMargin <= 1 ? 2 : 0)
      + (roundState.avgLatencyMs >= 250 ? 2 : 0)
      + (roundState.partitioned ? 1 : 0)
      + (roundState.votePressure >= 2 ? 1 : 0)
      + this.seed;
    if (score >= 7) return 'quorum_disruption';
    if (score >= 5) return 'timing_equivocation';
    if (score >= 3) return 'selective_suppression';
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