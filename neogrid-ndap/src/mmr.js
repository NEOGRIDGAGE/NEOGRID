const { hashData } = require('./utils');

const GENESIS_ROOT = hashData('ndap:v2:mmr:genesis');

class LinkedMMR {
  constructor() {
    this._entries = [];
    this._currentRoot = GENESIS_ROOT;
  }

  _computeNewRoot(prevRoot, txHash, index, timestamp) {
    return hashData(`ndap:v2:mmr:${prevRoot}:${txHash}:${index}:${timestamp}`);
  }

  appendLinked(txHash, prevRoot, newRoot) {
    const index = this._entries.length;
    const timestamp = Date.now();
    const mmrRoot = this._computeNewRoot(prevRoot, txHash, index, timestamp);
    const entry = { index, txHash, prevRoot, newRoot, timestamp, mmrRoot };
    this._entries.push(entry);
    this._currentRoot = mmrRoot;
    return entry;
  }

  append(data) {
    const txHash = hashData(typeof data === 'string' ? data : JSON.stringify(data));
    const index = this._entries.length;
    const timestamp = Date.now();
    const prevRoot = this._currentRoot;
    const newRoot = prevRoot;
    const mmrRoot = this._computeNewRoot(prevRoot, txHash, index, timestamp);
    const entry = { index, txHash, prevRoot, newRoot, timestamp, mmrRoot };
    this._entries.push(entry);
    this._currentRoot = mmrRoot;
    return index;
  }

  getAll() {
    return this._entries;
  }

  getAt(index) {
    if (index < 0 || index >= this._entries.length) return null;
    return this._entries[index];
  }

  currentRoot() {
    return this._currentRoot;
  }

  size() {
    return this._entries.length;
  }

  verify() {
    let root = GENESIS_ROOT;
    for (const entry of this._entries) {
      if (entry.prevRoot !== undefined && entry.prevRoot !== entry.newRoot) {
      }
      const expected = this._computeNewRoot(entry.prevRoot, entry.txHash, entry.index, entry.timestamp);
      if (expected !== entry.mmrRoot) return { valid: false, failedAt: entry.index };
      root = entry.mmrRoot;
    }
    return { valid: true, root };
  }
}

module.exports = { LinkedMMR, GENESIS_ROOT };
