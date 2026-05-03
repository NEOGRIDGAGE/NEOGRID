const { SafetyInvariant, QuorumInvariant, DeterminismInvariant, ValidatorConsistencyInvariant } = require('./invariants');

class ModelChecker {
  constructor() {
    this.invariants = [
      new SafetyInvariant(),
      new QuorumInvariant(),
      new DeterminismInvariant(),
      new ValidatorConsistencyInvariant(),
    ];
  }

  simulate(trace) {
    const violations = [];
    for (const invariant of this.invariants) {
      const result = invariant.check(trace);
      if (!result.ok) violations.push(result);
    }
    return {
      ok: violations.length === 0,
      violations,
      trace,
    };
  }

  explain(result) {
    if (result.ok) return 'PASS';
    return result.violations.map((v) => `${v.name}: ${v.detail || 'violation'}`).join('\n');
  }
}

module.exports = { ModelChecker };