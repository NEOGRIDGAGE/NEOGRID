class NetworkEmulator {
  constructor({ topology = 10 } = {}) {
    this._nodes = new Map();
    this._topology = topology;
    this._stochastic = { mean: 40, stddev: 18, jitter: 12 };
    this._dropProb = 0;
    this._burst = null;
    this._partitions = null;
    this._epoch = 0;
    this._stats = { sent: 0, dropped: 0, delayed: 0, reordered: 0 };
    this._queue = [];
  }

  register(node) {
    this._nodes.set(node.nodeId, node);
    node.attachEmulator(this);
    return this;
  }

  setTopology(size) {
    this._topology = size;
    return this;
  }

  delayMessages(msRange) {
    const [min, max] = msRange;
    this._stochastic = { ...this._stochastic, mean: (min + max) / 2, stddev: Math.max(1, (max - min) / 6) };
    return this;
  }

  dropMessages(probability) {
    this._dropProb = Math.max(0, Math.min(0.1, probability));
    return this;
  }

  reorderMessages(windowSize) {
    this._reorderWindow = windowSize;
    return this;
  }

  burstFailure({ startEpoch = 0, duration = 1, dropMultiplier = 2, delayMultiplier = 2 } = {}) {
    this._burst = { startEpoch, duration, dropMultiplier, delayMultiplier };
    return this;
  }

  partitionNetwork(groups) {
    this._partitions = new Map();
    groups.forEach((groupNodeIds, idx) => {
      for (const id of groupNodeIds) this._partitions.set(id, idx);
    });
    return this;
  }

  randomPartition(epoch = this._epoch) {
    const ids = Array.from(this._nodes.keys());
    const split = Math.max(1, Math.floor(ids.length / 2 + (Math.random() - 0.5) * Math.min(4, ids.length / 3)));
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    this.partitionNetwork([shuffled.slice(0, split), shuffled.slice(split)]);
    this._epoch = epoch;
    return this;
  }

  healNetwork() {
    this._partitions = null;
    this._burst = null;
    return this;
  }

  route(fromId, msg, meta = {}) {
    this._stats.sent++;
    const recipients = Array.from(this._nodes.keys()).filter((id) => id !== fromId);
    for (const toId of recipients) {
      if (!this._canDeliver(fromId, toId, meta)) {
        this._stats.dropped++;
        continue;
      }
      if (Math.random() < this._effectiveDrop()) {
        this._stats.dropped++;
        continue;
      }
      const delay = this._sampleDelay(meta);
      if (delay <= 0 && !this._reorderWindow) {
        this._deliver(toId, msg);
      } else {
        this._stats.delayed++;
        const envelope = { toId, msg, at: Date.now() + delay };
        if (this._reorderWindow) {
          this._queue.push(envelope);
          if (this._queue.length >= this._reorderWindow) this._flushQueue();
        } else {
          setTimeout(() => this._deliver(toId, msg), delay);
        }
      }
    }
  }

  flush() {
    this._flushQueue();
  }

  stats() {
    return { ...this._stats, nodes: this._nodes.size, topology: this._topology };
  }

  _canDeliver(fromId, toId, meta = {}) {
    if (!this._partitions) return true;
    if (meta.forceDeliver) return true;
    return this._partitions.get(fromId) === this._partitions.get(toId);
  }

  _effectiveDrop() {
    if (!this._burst) return this._dropProb;
    if (this._epoch >= this._burst.startEpoch && this._epoch < this._burst.startEpoch + this._burst.duration) {
      return Math.min(0.5, this._dropProb * this._burst.dropMultiplier);
    }
    return this._dropProb;
  }

  _sampleDelay(meta = {}) {
    if (meta.priority === 'low') return Math.max(0, this._gaussianDelay() * 1.2);
    return this._gaussianDelay();
  }

  _gaussianDelay() {
    const { mean, stddev, jitter } = this._stochastic;
    const u1 = Math.max(Number.EPSILON, Math.random());
    const u2 = Math.random();
    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const noisy = mean + gaussian * stddev + (Math.random() - 0.5) * jitter;
    return Math.max(0, Math.round(noisy));
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