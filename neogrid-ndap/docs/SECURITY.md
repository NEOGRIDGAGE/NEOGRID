# NDAP Security Model

**Version:** 1.0.0
**Status:** Draft

This document describes the threat model, identified risks, and mitigations for the NeoGrid NDAP protocol.

---

## 1. Trust Assumptions

- The API server is assumed to be operated by a trusted party.
- IPFS nodes are untrusted; content is verified by CID (content hash).
- Clients are untrusted; all inputs are validated server-side.
- The Rust core is assumed to be free of memory-safety bugs (enforced by the compiler).

---

## 2. Threat Model

### 2.1 Data Tampering

**Threat:** An attacker modifies stored asset data or the SMT after the fact.

**Impact:** Proof verification would fail or return incorrect results, enabling fraud.

**Mitigations:**
- SMT root is recomputed on every read and write — any modification changes the root.
- IPFS CIDs are content-addressed: fetching a CID always returns the exact bytes that produced it.
- Rust SHA-256 implementation has no mutable global state.

---

### 2.2 Replay Attacks

**Threat:** An attacker captures a valid `POST /transfer` request and replays it to re-transfer ownership.

**Impact:** Assets could be transferred multiple times without the owner's consent.

**Mitigations:**
- Each transaction includes a `timestamp` field; replayed requests with stale timestamps should be rejected (implement a server-side nonce or sliding-window check in production).
- Transaction IDs are derived from `SHA256(payload + timestamp)` — identical payloads at different times produce different IDs.
- **Recommended hardening:** Require clients to include a per-request nonce and reject duplicate `id` values within a configurable window.

---

### 2.3 Key Compromise

**Threat:** An attacker obtains a user's ed25519 private key and forges transfer signatures.

**Impact:** Full loss of control over assets owned by the compromised key.

**Mitigations:**
- Private keys are never transmitted to the server; only signatures and public keys are sent.
- DID resolution does not expose private key material.
- **Recommended hardening:** Implement a key-rotation mechanism that updates `did:neogrid:<id>` to point to a new public key, with the rotation event logged in the MMR.

---

### 2.4 IPFS Availability / Censorship

**Threat:** The IPFS node becomes unavailable or a CID is garbage-collected before retrieval.

**Impact:** Asset data may be temporarily or permanently unretrievable.

**Mitigations:**
- The API falls back to a deterministic simulated CID based on SHA-256 of the payload when IPFS is unreachable.
- **Recommended hardening:** Pin CIDs to a dedicated IPFS node or a pinning service (e.g., Pinata, web3.storage). Store a local copy of asset data alongside the CID.

---

### 2.5 SMT Root Forgery

**Threat:** An attacker submits a crafted proof that makes a non-existent key appear present in the SMT.

**Impact:** False proofs could be used to claim ownership of unregistered assets.

**Mitigations:**
- The SMT root is computed server-side and never accepted from clients.
- Proofs are verified against the server's own computed root.
- **Recommended hardening:** Publish SMT roots to a public append-only ledger so clients can independently verify the root.

---

### 2.6 Denial of Service (DoS)

**Threat:** An attacker floods the API with large or malformed requests.

**Impact:** Server resources are exhausted, legitimate users are blocked.

**Mitigations:**
- `body-parser` limits request body size (default 100 kb).
- **Recommended hardening:** Add rate limiting (e.g., `express-rate-limit`), request-size caps, and authentication middleware before production deployment.

---

## 3. Out-of-Scope Threats (v1.0)

The following are acknowledged but deferred to future versions:

- **Side-channel attacks** on the SHA-256 implementation (mitigated by using the audited `sha2` Rust crate and Node.js `crypto` module).
- **ZK circuit soundness** — the Circom circuit is a placeholder; a formal audit is required before any production ZK usage.
- **Consensus / multi-party trust** — NDAP v1.0 is single-operator; Byzantine fault tolerance is a v2 concern.

---

## 4. Responsible Disclosure

To report a security vulnerability, contact the NeoGrid team privately before public disclosure. Include a detailed description, reproduction steps, and any relevant proof-of-concept code.
