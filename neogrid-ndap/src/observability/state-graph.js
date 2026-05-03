class StateGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  addState(state) {
    this.nodes.set(state.stateRoot, state);
    if (state.prevRoot) {
      this.edges.push({ from: state.prevRoot, to: state.stateRoot });
    }
  }

  toJSON() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
    };
  }
}

module.exports = { StateGraph };
