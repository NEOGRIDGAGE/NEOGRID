# NeoGrid NDAP

**Verifiable DID Asset Protocol**

NeoGrid NDAP is a production-grade, verifiable asset protocol that combines cryptographic proofs, decentralized identity, and content-addressed storage into a coherent, auditable system.

---

## Features

- **Merkle verification** — Sparse Merkle Tree (SMT) with deterministic root computation and existence proofs
- **MMR logs** — Append-only Merkle Mountain Range for tamper-evident event history
- **IPFS distribution** — All asset data is content-addressed and stored via IPFS; falls back to a simulated CID when no IPFS node is reachable
- **Rust core** — SHA-256 hashing and transaction validation implemented in Rust (`ndap-core` crate)
- **zk-ready** — Circom circuit placeholder for zero-knowledge balance proofs (`TxVerify`)
- **Formal spec** — TLA+ module (`NDAP`) with state invariants and safety properties

---

## Quick Start

```bash
cd neogrid-ndap
npm install
node index.js
```

The server prints **NDAP READY** and listens on port `3000` (or `$PORT`).

---

## API

### `POST /data`

Store a new asset.

**Body:**
```json
{ "data": { "name": "MyAsset", "value": 42 }, "owner": "alice" }
```

**Response:**
```json
{ "key": "<sha256>", "cid": "<ipfs-cid>", "root": "<smt-root>", "logIndex": 0 }
```

---

### `POST /transfer`

Transfer ownership of an asset.

**Body:**
```json
{ "key": "<asset-key>", "from": "alice", "to": "bob" }
```

**Response:**
```json
{ "success": true, "tx": { ... }, "logIndex": 1, "root": "<smt-root>" }
```

---

### `POST /verify`

Verify a key's existence in the SMT, optionally verify a signed transaction.

**Body:**
```json
{ "key": "<asset-key>", "proof": { ... } }
```

**Response:**
```json
{ "valid": true, "smtProof": { "key": "...", "exists": true, "root": "...", "siblings": [...] } }
```

---

### `GET /log`

Return the full MMR log of all events.

**Response:**
```json
{ "log": ["<hash>", "<hash>", ...], "count": 2 }
```

---

## Project Structure

```
neogrid-ndap/
├── index.js              # Express API server
├── src/
│   ├── utils.js          # SHA-256 helper
│   ├── smt.js            # Sparse Merkle Tree
│   ├── mmr.js            # Merkle Mountain Range log
│   ├── did.js            # DID generation (ed25519)
│   ├── tx.js             # Transaction create / sign / verify
│   └── ipfs.js           # IPFS upload (with simulation fallback)
├── core-rust/            # Rust crate: ndap-core
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── hash.rs       # SHA-256 (sha2 crate)
│       └── tx.rs         # Transaction struct + validate()
├── zk/
│   └── circuits/
│       └── tx.circom     # Circom zk balance-check circuit
├── spec/
│   └── ndap.tla          # TLA+ formal specification
└── docs/
    ├── README.md
    ├── SPEC.md
    └── SECURITY.md
```

---

## Rust Core

The Rust crate provides high-performance, auditable implementations of the cryptographic primitives.

```bash
cd core-rust
cargo build
cargo test
```

---

## ZK Circuit

The Circom circuit (`zk/circuits/tx.circom`) is a placeholder. To compile:

```bash
circom zk/circuits/tx.circom --r1cs --wasm --sym
```

A trusted setup (Powers of Tau) is required before production use.

---

## License

MIT
