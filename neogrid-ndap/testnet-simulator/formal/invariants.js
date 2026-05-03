class SafetyInvariant {
  check(trace) {
    const byHeight = new Map();
    for (const step of trace) {
      for (const state of step.finalized || []) {
        if (!byHeight.has(state.height)) byHeight.set(state.height, new Set());
        byHeight.get(state.height).add(state.stateRoot);
      }
    }
    for (const [height, roots] of byHeight.entries()) {
      if (roots.size > 1) {
        return { ok: false, name: 'SafetyInvariant', detail: `conflicting finalization at height ${height}`, height };
      }
    }
    return { ok: true, name: 'SafetyInvariant' };
  }
}

class QuorumInvariant {
  check(trace) {
    for (const step of trace) {
      if (step.finalized && step.finalized.length) {
        for (const state of step.finalized) {
          if (!state.commitCert || state.commitCert.length < step.quorumThreshold) {
            return { ok: false, name: 'QuorumInvariant', detail: `height ${state.height} below quorum` };
          }
        }
      }
    }
    return { ok: true, name: 'QuorumInvariant' };
  }
}

class DeterminismInvariant {
  check(trace) {
    const seen = new Map();
    for (const step of trace) {
      const key = JSON.stringify(step.inputs || {});
      const root = step.stateRoot;
      if (seen.has(key) && seen.get(key) !== root) {
        return { ok: false, name: 'DeterminismInvariant', detail: 'same input produced different root' };
      }
      seen.set(key, root);
    }
    return { ok: true, name: 'DeterminismInvariant' };
  }
}

class ValidatorConsistencyInvariant {
  check(trace) {
    const snapshot = JSON.stringify(trace[0]?.validatorSet || null);
    for (const step of trace) {
      if (JSON.stringify(step.validatorSet || null) !== snapshot) {
        return { ok: false, name: 'ValidatorConsistencyInvariant', detail: 'validator set diverged across nodes' };
      }
    }
    return { ok: true, name: 'ValidatorConsistencyInvariant' };
  }
}

module.exports = { SafetyInvariant, QuorumInvariant, DeterminismInvariant, ValidatorConsistencyInvariant };