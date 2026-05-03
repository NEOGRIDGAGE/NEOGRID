class ProtocolChecker {
  constructor() {
    this._violations = [];
    this._runs = [];
  }

  evaluateRun(runResult) {
    this._runs.push(runResult);
    if (!runResult.pass) {
      this._violations.push({ property: 'SAFETY', detail: runResult.detail });
    }
    return this;
  }

  checkAll(nodes) {
    this._violations = [];
    const byHeight = new Map();
    for (const node of nodes) {
      for (const state of node.finalized) {
        if (!byHeight.has(state.height)) byHeight.set(state.height, new Set());
        byHeight.get(state.height).add(state.stateRoot);
      }
    }
    for (const [height, roots] of byHeight.entries()) {
      if (roots.size > 1) {
        this._violations.push({ property: 'SAFETY', detail: `Double finalization at height=${height}: ${[...roots].join(', ')}` });
      }
    }
    for (const node of nodes) {
      for (const state of node.finalized) {
        if (!state.commitCert || state.commitCert.length === 0) {
          this._violations.push({ property: 'QUORUM', detail: `Finalized state at height=${state.height} has no commitCert (node ${node.nodeIndex})` });
        }
        if (state.smtRoot !== state.stateRoot) {
          this._violations.push({ property: 'SMT_MMR_CONSISTENCY', detail: `smtRoot != stateRoot at height=${state.height} (node ${node.nodeIndex})` });
        }
      }
    }
    return this;
  }

  summarizeRuns() {
    const total = this._runs.length || 1;
    const passes = this._runs.filter((r) => r.pass).length;
    const finalitySuccessRate = Math.round((passes / total) * 1000) / 10;
    const stability = Math.max(0, Math.min(100, Math.round(100 - this._violations.length * 10)));
    const resilience = Math.max(0, Math.min(100, Math.round((finalitySuccessRate + stability) / 2)));
    return {
      safety: this._violations.length === 0 ? 'PASS' : 'FAIL',
      resilienceScore: resilience,
      convergenceStability: stability,
      adversarialResistance: Math.max(0, Math.min(100, 100 - this._violations.length * 7)),
      finalitySuccessRate,
      failureClassification: this._violations.length ? this._violations[0].property : null,
      runs: this._runs,
      violations: this._violations,
    };
  }

  passed() {
    return this._violations.length === 0;
  }

  violations() {
    return [...this._violations];
  }

  summary() {
    if (this.passed()) return 'PASS — all protocol properties hold';
    return 'FAIL — protocol violations:\n' + this._violations.map((v) => `  [${v.property}] ${v.detail}`).join('\n');
  }
}

module.exports = { ProtocolChecker };