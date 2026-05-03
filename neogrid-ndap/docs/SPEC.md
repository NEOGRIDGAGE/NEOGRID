# NDAP Protocol Specification

**Version:** 1.0.0
**Status:** Draft

---

## 1. DID Format

NeoGrid DIDs follow the W3C DID Core specification with the `neogrid` method.

### Syntax

```
did:neogrid:<method-specific-id>
```

- **Method:** `neogrid`
- **Method-specific ID:** lowercase hex SHA-256 of the raw DER-encoded ed25519 public key (SPKI format)

### Example

```
did:neogrid:3b9a4f2c1e8d7a056f...
```

### Key Generation

1. Generate an ed25519 keypair.
2. Export the public key as DER (SPKI).
3. Compute `SHA256(publicKeyDER)` → hex string → append to `did:neogrid:`.

---

## 2. Transaction Format

All state changes are represented as signed transaction objects.

### Schema

```json
{
  "id": "<sha256 of payload + timestamp>",
  "payload": {
    "key":       "<asset key — sha256 of original data>",
    "from":      "<owner DID or identifier>",
    "to":        "<recipient DID or identifier>",
    "timestamp": 1700000000000
  },
  "timestamp": 1700000000000,
  "signature": "<hex-encoded ed25519 signature over JSON(payload)>"
}
```

### Field Rules

| Field       | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| `id`        | string | yes      | SHA-256 of `payload + timestamp`         |
| `payload`   | object | yes      | The semantic content of the transaction  |
| `timestamp` | number | yes      | Unix epoch milliseconds                  |
| `signature` | string | no       | Ed25519 signature; null until signed     |

---

## 3. State Transition Rules

### 3.1 Asset Registration (`POST /data`)

**Preconditions:**
- `data` field must be non-empty.

**Effect:**
1. Compute `key = SHA256(JSON(data))`.
2. Upload `data` to IPFS → obtain `cid`.
3. Insert `(key → cid)` into the SMT.
4. Append `cid` to the MMR log.
5. Record `owner` in the ownership map (if provided).

**Postconditions:**
- `key` is present in the SMT.
- `logIndex` is the index of the new MMR entry.
- `root` reflects the updated SMT.

### 3.2 Asset Transfer (`POST /transfer`)

**Preconditions:**
- `key` must exist in the ownership map.
- `from` must equal the current owner of `key`.
- `to` must be distinct from `from`.

**Effect:**
1. Create a transaction object `{ key, from, to, timestamp }`.
2. Update `ownershipMap[key] = to`.
3. Append `SHA256(JSON(tx))` to the MMR log.

**Postconditions:**
- `ownershipMap[key]` equals `to`.
- Transfer is recorded in the MMR.

### 3.3 Proof Verification (`POST /verify`)

**Input:** `key` and optional signed transaction `proof`.

**Effect:**
1. Look up `key` in the SMT → return an existence proof with siblings.
2. If `proof` is provided, verify the ed25519 signature (or structural integrity if no public key is given).

**Output:** `{ valid: bool, smtProof: { key, value, exists, root, siblings } }`

---

## 4. Sparse Merkle Tree

- **Leaf value:** `SHA256("<key>:<cid>")`
- **Root:** `SHA256(sorted leaf concatenation)`
- **Proof:** list of sibling hashes along the path to root

---

## 5. Merkle Mountain Range

- Append-only array of `SHA256` hashes.
- Indices are zero-based and stable.
- No entries are ever removed or modified.
