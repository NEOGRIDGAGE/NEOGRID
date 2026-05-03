const { hashData } = require('./utils');

class SMT {
  constructor() {
    this.store = {};
  }

  set(key, value) {
    this.store[key] = value;
  }

  get(key) {
    return this.store[key] || null;
  }

  computeRoot() {
    const sortedKeys = Object.keys(this.store).sort();
    if (sortedKeys.length === 0) return hashData('empty');
    const combined = sortedKeys.map(k => `${k}:${this.store[k]}`).join('|');
    return hashData(combined);
  }

  getProof(key) {
    const exists = key in this.store;
    const value = exists ? this.store[key] : null;
    const root = this.computeRoot();
    const sortedKeys = Object.keys(this.store).sort();
    const siblings = sortedKeys
      .filter(k => k !== key)
      .map(k => hashData(`${k}:${this.store[k]}`));
    return { key, value, exists, root, siblings };
  }
}

module.exports = { SMT };
