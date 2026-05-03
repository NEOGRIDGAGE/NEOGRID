class NetworkEmulator {
  constructor() {
    this._nodes        = new Map();   // nodeId -> SimulatedNode
    this._delayRange   = [0, 0];
    this._dropProb     = 0;
    this._reorderWin   = 0;
    this._partitions   = null;        // null = no partition, Map<nodeId, groupId>
    this._queue        = [];
    this._stats        = { sent: 0, dropped: 0, delayed: 0, reordered: 0 };
  }

  register(node) {
    this._nodes.set(node.nodeId, node);
    node.attachEmulator(this);
    return this;
  }

  // ── Controls ────────────────────────────────────────────────────────────────

  delayMessages([minMs, maxMs]) {
    this._delayRange = [minMs, maxMs];
    return this;
  }

  dropMessages(probability) {
    this._dropProb = Math.max(0, Math.min(1, probability));
    return this;
  }

  reorderMessages(windowSize) {
    this._reorderWin = windowSize;
    return this;
  }

  partitionNetwork(groups) {
    this._partitions = new Map();
    groups.forEach((groupNodeIds, idx) => {
      for (const id of groupNodeIds) this._partitions.set(id, idx);
    });
    return this;
  }

  healNetwork() {
    this._partitions = null;
    this._stats.reordered = 0;
    return this;
  }

  reset() {
    this._delayRange = [0, 0];
    this._dropProb   = 0;
    this._reorderWin = 0;
    this._partitions = null;
    this._queue      = [];
    return this;
  }

  stats() { return { ...this._stats }; }

  // ── Routing ─────────────────────────────────────────────────────────────────

  route(fromId, msg) {
    this._stats.sent++;

    const recipients = Array.from(this._nodes.keys()).filter((id) => id !== fromId);

    for (const toId of recipients) {
      if (!this._canDeliver(fromId, toId)) {
        this._stats.dropped++;
        continue;
      }
      if (Math.random() < this._dropProb) {
        this._stats.dropped++;
        continue;
      }

      const delay = this._sampleDelay();
      if (delay === 0 && this._reorderWin === 0) {
        this._deliver(toId, msg);
      } else {
        this._stats.delayed++;
        const envelope = { toId, msg, at: Date.now() + delay };
        if (this._reorderWin > 0) {
          this._queue.push(envelope);
          if (this._queue.length >= this._reorderWin) {
            this._flushQueue();
          }
        } else {
          setTimeout(() => this._deliver(toId, msg), delay);
        }
      }
    }
  }

  // Flush any pending reorder queue immediately (call after scenarios end to drain)
  flush() {
    this._flushQueue();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _canDeliver(fromId, toId) {
    if (!this._partitions) return true;
    return this._partitions.get(fromId) === this._partitions.get(toId);
  }

  _sampleDelay() {
    const [min, max] = this._delayRange;
    if (min === 0 && max === 0) return 0;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _deliver(toId, msg) {
    const node = this._nodes.get(toId);
    if (node) node.receiveMessage(msg);
  }

  _flushQueue() {
    const shuffled = [...this._queue].sort(() => Math.random() - 0.5);
    this._stats.reordered += shuffled.length;
    this._queue = [];
    for (const { toId, msg, at } of shuffled) {
      const wait = Math.max(0, at - Date.now());
      setTimeout(() => this._deliver(toId, msg), wait);
    }
  }
}

module.exports = { NetworkEmulator };