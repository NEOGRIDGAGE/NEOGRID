const path = require('path');
const fs = require('fs');
const { hashData } = require('./utils');
const { BinarySMT } = require('./smt');
const { LinkedMMR } = require('./mmr');
const { validateTxStructure, canonicalize, txHash } = require('./tx');
const { uploadToIPFS, canonicalHash } = require('./ipfs');

const RUST_BINARY = path.join(__dirname, '../core-rust/target/release/ndap-engine');

class Engine {
  constructor() {
    this._smt = new BinarySMT();
    this._mmr = new LinkedMMR();
    this._usedNonces = new Set();
    this._ownership = {};
    this._balances = {};
    this._assets = {};
    this._rustAvailable = fs.existsSync(RUST_BINARY);
  }

  rustAvailable() {
    return this._rustAvailable;
  }

  validate_transaction(tx) {
    const structural = validateTxStructure(tx);
    if (!structural.valid) return { valid: false, errors: structural.errors };

    const errors = [];

    if (this._usedNonces.has(tx.nonce)) {
      errors.push(`Replay attack detected: nonce "${tx.nonce}" already consumed`);
    }

    const currentOwner = this._ownership[tx.assetId];
    if (currentOwner && currentOwner !== tx.fromDID) {
      errors.push(`Ownership violation: asset "${tx.assetId}" is owned by "${currentOwner}", not "${tx.fromDID}"`);
    }

    if (tx.amount !== undefined && tx.amount > 0) {
      const balance = this._balances[tx.fromDID] || 0;
      if (balance < tx.amount) {
        errors.push(`Insufficient balance: have ${balance}, need ${tx.amount}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  apply_transaction(tx) {
    const validation = this.validate_transaction(tx);
    if (!validation.valid) {
      throw new Error(`Transaction rejected: ${validation.errors.join('; ')}`);
    }

    const prevRoot = this.compute_state_root();
    const hash = txHash(tx);

    this._usedNonces.add(tx.nonce);

    if (tx.assetId && tx.toDID) {
      this._ownership[tx.assetId] = tx.toDID;
      this._smt.set(tx.assetId, tx.toDID);
    }

    if (tx.amount && tx.amount > 0) {
      this._balances[tx.fromDID] = (this._balances[tx.fromDID] || 0) - tx.amount;
      this._balances[tx.toDID] = (this._balances[tx.toDID] || 0) + tx.amount;
    }

    const newRoot = this.compute_state_root();
    const logEntry = this._mmr.appendLinked(hash, prevRoot, newRoot);

    return { prevRoot, newRoot, txHash: hash, logEntry };
  }

  async register_asset(assetId, owner, data) {
    const { cid, contentHash } = await uploadToIPFS(data);
    const prevRoot = this.compute_state_root();

    this._assets[assetId] = { cid, contentHash, owner, data };
    this._ownership[assetId] = owner;
    this._smt.set(assetId, cid);

    const newRoot = this.compute_state_root();
    const entryHash = hashData(`register:${assetId}:${cid}:${owner}`);
    const logEntry = this._mmr.appendLinked(entryHash, prevRoot, newRoot);

    return { assetId, cid, contentHash, root: newRoot, logEntry };
  }

  compute_state_root() {
    return this._smt.computeRoot();
  }

  get_proof(key) {
    return this._smt.getProof(key);
  }

  verify_proof(proof) {
    return this._smt.verifyProof(proof);
  }

  get_log() {
    return this._mmr.getAll();
  }

  get_mmr_root() {
    return this._mmr.currentRoot();
  }

  verify_log_integrity() {
    return this._mmr.verify();
  }

  get_ownership(assetId) {
    return this._ownership[assetId] || null;
  }

  get_balance(did) {
    return this._balances[did] || 0;
  }

  snapshot() {
    return {
      stateRoot: this.compute_state_root(),
      mmrRoot: this.get_mmr_root(),
      logSize: this._mmr.size(),
      usedNonces: this._usedNonces.size,
      assets: Object.keys(this._ownership).length,
      rustEngine: this._rustAvailable,
    };
  }
}

module.exports = { Engine };
