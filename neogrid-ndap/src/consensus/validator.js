class ValidatorSet {
  constructor() {
    this._validators = new Map(); // nodeId -> { stake, reputation, weight, pubKeyHex }
  }

  addValidator({ nodeId, stake, reputation, pubKeyHex }) {
    this._validators.set(nodeId, { stake, reputation, weight: stake * reputation, pubKeyHex });
    return this;
  }

  removeValidator(nodeId) {
    this._validators.delete(nodeId);
    return this;
  }

  get(nodeId)  { return this._validators.get(nodeId) || null; }
  has(nodeId)  { return this._validators.has(nodeId); }
  count()      { return this._validators.size; }

  totalWeight() {
    let w = 0;
    for (const v of this._validators.values()) w += v.weight;
    return w;
  }

  quorumThreshold() {
    return (this.totalWeight() * 2) / 3;
  }

  hasQuorum(nodeIds) {
    let w = 0;
    for (const id of nodeIds) {
      const v = this._validators.get(id);
      if (v) w += v.weight;
    }
    return w >= this.quorumThreshold();
  }

  getLeader(height, view = 0) {
    const ids = Array.from(this._validators.keys()).sort();
    if (ids.length === 0) return null;
    return ids[(height + view) % ids.length];
  }

  getAll() {
    return Array.from(this._validators.entries()).map(([nodeId, v]) => ({ nodeId, ...v }));
  }
}

module.exports = { ValidatorSet };
