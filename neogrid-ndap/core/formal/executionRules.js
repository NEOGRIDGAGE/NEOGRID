function executionRules() {
  return [
    'no conflicting finalized states at same height',
    'final state requires >= 2/3 weighted quorum',
    'validator set identical across honest nodes per epoch',
    'deterministic transitions for ordered event sets',
  ];
}

module.exports = { executionRules };