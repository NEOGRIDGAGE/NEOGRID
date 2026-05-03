class ProtocolChecker {
  constructor() {
    this._violations = [];
  }

  // Collect all finalized states across all nodes and verify safety properties
  checkAll(nodes) {
    this._violations = [];

    // Aggregate all finalized states by height
    const byHeight = new Map(); // height -> Set of stateRoots
    for (const node of nodes) {
      for (const state of node.finalized) {
        if (!byHeight.has(state.height)) byHeight.set(state.height, new Set());
        byHeight.get(state.height).add(state.stateRoot);
      }
    }

    // Safety: no two different state roots at the same height
    for (const [height, roots] of byHeight.entries()) {
      if (roots.size > 1) {
        this._violations.push({
          property: 'SAFETY',
          detail:   `Double finalization at height=${height}: ${[...roots].join(', ')}`,
        });
      }
    }

    // Quorum: every finalized state must have commitCert.length >= 1
    for (const node of nodes) {
      for (const state of node.finalized) {
        if (!state.commitCert || state.commitCert.length === 0) {
          this._violations.push({
            property: 'QUORUM',
            detail:   `Finalized state at height=${state.height} has no commitCert (node ${node.nodeIndex})`,
          });
        }
      }
    }

    // SMT/MMR consistency: smtRoot must equal stateRoot (as per NDAP design)
    for (const node of nodes) {
      for (const state of node.finalized) {
        if (state.smtRoot !== state.stateRoot) {
          this._violations.push({
            property: 'SMT_MMR_CONSISTENCY',
            detail:   `smtRoot != stateRoot at height=${state.height} (node ${node.nodeIndex})`,
          });
        }
      }
    }

    // Convergence: honest nodes must agree on same latest height
    const honestNodes  = nodes.filter((n) => !n.isByzantine());
    const heights      = honestNodes.map((n) => n.finalized.length ? n.finalized[n.finalized.length - 1].height : null);
    const nonNull      = heights.filter((h) => h !== null);
    if (honestNodes.length > 1 && nonNull.length > 0) {
      const maxH = Math.max(...nonNull);
      const minH = Math.min(...nonNull);
      if (maxH !== minH) {
        this._violations.push({
          property: 'CONVERGENCE',
          detail:   `Honest nodes disagree on latest finalized height: min=${minH} max=${maxH}`,
        });
      }
    }

    return this;
  }

  // After a partition heals, check convergence on finalized states
  checkConvergence(nodes, { maxHeightDelta = 0 } = {}) {
    const honest   = nodes.filter((n) => !n.isByzantine());
    const heights  = honest.map((n) => n.finalized.length ? n.finalized[n.finalized.length - 1].height : -1);
    const maxH     = Math.max(...heights);
    const minH     = Math.min(...heights);
    if (maxH - minH > maxHeightDelta) {
      this._violations.push({
        property: 'POST_PARTITION_CONVERGENCE',
        detail:   `After heal, height delta too large: min=${minH} max=${maxH} allowed_delta=${maxHeightDelta}`,
      });
    }
    return this;
  }

  passed()     { return this._violations.length === 0; }
  violations() { return [...this._violations]; }

  summary() {
    if (this.passed()) return 'PASS — all protocol properties hold';
    return 'FAIL — protocol violations:\n' + this._violations.map((v) => `  [${v.property}] ${v.detail}`).join('\n');
  }
}

module.exports = { ProtocolChecker };