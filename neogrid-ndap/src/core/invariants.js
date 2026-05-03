function assertNoDoubleFinalization(height, stateRoot, finalizedStates = new Map()) {
  const existing = finalizedStates.get(height);
  if (existing && existing !== stateRoot) {
    throw new Error(`DOUBLE_FINALIZATION height=${height}`);
  }
}

function assertSMTMatchesMMR(state) {
  if (!state || state.smtRoot !== state.stateRoot) {
    throw new Error('SMT_MMR_MISMATCH');
  }
  if (!state.mmrRoot) {
    throw new Error('MMR_ROOT_MISSING');
  }
}

function assertValidQuorum(votes, totalWeight) {
  const weight = votes.reduce((sum, vote) => sum + (vote.weight || 0), 0);
  if (weight < (2 * totalWeight) / 3) {
    throw new Error('INSUFFICIENT_QUORUM');
  }
}

function assertValidStateTransition(prevState, nextState) {
  const allowed = {
    IDLE: ['PROPOSING', 'VIEW_CHANGE'],
    PROPOSING: ['PREVOTING', 'VIEW_CHANGE'],
    PREVOTING: ['PRECOMMITTING', 'VIEW_CHANGE'],
    PRECOMMITTING: ['FINALIZED', 'VIEW_CHANGE'],
    FINALIZED: ['IDLE', 'VIEW_CHANGE'],
    VIEW_CHANGE: ['PROPOSING', 'PREVOTING', 'IDLE'],
  };
  const next = allowed[prevState];
  if (!next || !next.includes(nextState)) {
    throw new Error(`INVALID_STATE_TRANSITION ${prevState}->${nextState}`);
  }
}

function assertValidatorSetConsistency(epoch, validators, snapshots = new Map()) {
  const snapshotHash = JSON.stringify([...validators].map(v => [v.nodeId, v.weight, v.pubKeyHex]).sort());
  const existing = snapshots.get(epoch);
  if (existing && existing !== snapshotHash) {
    throw new Error(`VALIDATOR_SET_INCONSISTENT epoch=${epoch}`);
  }
  snapshots.set(epoch, snapshotHash);
  return snapshotHash;
}

module.exports = {
  assertNoDoubleFinalization,
  assertSMTMatchesMMR,
  assertValidQuorum,
  assertValidStateTransition,
  assertValidatorSetConsistency,
};
