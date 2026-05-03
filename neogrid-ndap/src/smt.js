const { hashData } = require('./utils');

const EMPTY_HASH = hashData('ndap:v2:empty_node');

function leafHash(key, value) {
  return hashData(`ndap:v2:leaf:${key}:${value}`);
}

function nodeHash(left, right) {
  return hashData(`ndap:v2:node:${left}:${right}`);
}

function getBit(hexKey, depth) {
  const byteIdx = depth >> 3;
  const bitPos = 7 - (depth & 7);
  const byte = parseInt(hexKey.substr(byteIdx * 2, 2), 16) || 0;
  return (byte >> bitPos) & 1;
}

function subtreeHash(entries, depth) {
  if (entries.length === 0) return EMPTY_HASH;
  if (depth === 256) {
    const [key, value] = entries[0];
    return leafHash(key, value);
  }
  const left = entries.filter(([k]) => getBit(k, depth) === 0);
  const right = entries.filter(([k]) => getBit(k, depth) === 1);
  const lh = subtreeHash(left, depth + 1);
  const rh = subtreeHash(right, depth + 1);
  if (lh === EMPTY_HASH && rh === EMPTY_HASH) return EMPTY_HASH;
  return nodeHash(lh, rh);
}

class BinarySMT {
  constructor() {
    this._leaves = new Map();
  }

  set(key, value) {
    this._leaves.set(key, value);
  }

  get(key) {
    return this._leaves.get(key) || null;
  }

  computeRoot() {
    return subtreeHash(Array.from(this._leaves.entries()), 0);
  }

  getProof(key) {
    const path = [];
    const directions = [];
    let entries = Array.from(this._leaves.entries());

    for (let depth = 0; depth < 256; depth++) {
      const bit = getBit(key, depth);
      const myEntries = entries.filter(([k]) => getBit(k, depth) === bit);
      const siblingEntries = entries.filter(([k]) => getBit(k, depth) !== bit);

      directions.push(bit);
      path.push(subtreeHash(siblingEntries, depth + 1));

      entries = myEntries;
      if (entries.length === 0) break;
    }

    const value = this._leaves.get(key) || null;
    const exists = value !== null;
    const root = this.computeRoot();
    const lHash = exists ? leafHash(key, value) : EMPTY_HASH;
    return { key, value, exists, root, path, directions, leafHash: lHash };
  }

  verifyProof(proof) {
    const { key, value, exists, path, directions } = proof;
    let current = exists ? leafHash(key, value) : EMPTY_HASH;
    for (let i = path.length - 1; i >= 0; i--) {
      const sibling = path[i];
      const dir = directions[i];
      current = dir === 0 ? nodeHash(current, sibling) : nodeHash(sibling, current);
    }
    return current === proof.root;
  }
}

module.exports = { BinarySMT, EMPTY_HASH, leafHash, nodeHash };
