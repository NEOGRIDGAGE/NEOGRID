# NDAP RFC v1.0

## 1. Protocol Identification

- **Protocol Name:** NDAP
- **Version:** v1.0
- **Status:** SPECIFICATION COMPLETE
- **Stability:** CANONICAL REFERENCE IMPLEMENTATION EXISTS

## 2. Abstract

NDAP is a Byzantine fault tolerant consensus protocol for replicated distributed state with verifiable finality. It defines a deterministic state machine, quorum-based finalization, and traceable execution semantics suitable for audit and reimplementation.

NDAP exists to provide Byzantine consensus plus verifiable distributed state in a form that is explicit, replayable, and auditable beyond traditional BFT systems. It emphasizes state traceability, deterministic replication, and clear separation between specification and implementation.

## 3. Protocol Goals

NDAP is designed to provide:

- safety under Byzantine faults
- deterministic state replication
- verifiable consensus finality
- trace-based auditability

## 4. System Model

### Nodes

- **Honest nodes** follow the protocol specification.
- **Byzantine nodes** may deviate arbitrarily.
- The protocol assumes at most **1/3** of nodes are Byzantine by weight.

### Network

- asynchronous
- unreliable
- adversarial scheduler

### Cryptography

- Ed25519 signatures
- SHA-256 hashing

## 5. State Model (Core)

Canonical state:

```text
State = {
  height,
  view,
  validatorSet,
  smtRoot,
  mmrRoot,
  phase,
  finalizedRoot
}
```

### Field Semantics

- **height**: logical block or decision height.
- **view**: current consensus view/round.
- **validatorSet**: weighted validator membership for the epoch.
- **smtRoot**: authenticated state root.
- **mmrRoot**: committed history root.
- **phase**: consensus phase indicator.
- **finalizedRoot**: root accepted as final.

### Field Invariants

- `height` increases monotonically.
- `view` changes only through timeout or view change.
- `validatorSet` must be identical across honest nodes per epoch.
- `smtRoot` and `mmrRoot` must correspond to the same committed state.
- `phase` must advance according to the transition system.
- `finalizedRoot` may change only on valid finalization.

## 6. State Transition Rules

### PROPOSE

**Preconditions:**
- leader is valid for current view
- proposal is signed
- proposal references current height and view

**Quorum:** none required for proposal creation.

**Mutation:**
- updates proposal-related state
- sets phase to proposal processing

### PREVOTE

**Preconditions:**
- proposal is valid
- signer is a member of validatorSet
- signature is valid

**Quorum:** may contribute toward 2/3 weighted threshold.

**Mutation:**
- records a prevote for the proposal
- advances phase toward commit preparation

### PRECOMMIT

**Preconditions:**
- sufficient prevote support exists
- vote is signed and valid

**Quorum:** requires progress toward weighted 2/3 support.

**Mutation:**
- records commit intent
- advances phase toward finalization

### FINALIZE

**Preconditions:**
- valid commit quorum exists
- state roots are consistent
- no conflicting finalized state exists at the same height

**Quorum:** at least 2/3 weighted votes.

**Mutation:**
- sets `finalizedRoot`
- marks state final for the height

### TIMEOUT

**Preconditions:**
- no valid progress within the current view window

**Quorum:** none.

**Mutation:**
- increments view
- may trigger leader reselection

### VIEW_CHANGE

**Preconditions:**
- timeout or view-change justification exists
- message is valid and signed

**Quorum:** view-change support according to consensus rules.

**Mutation:**
- updates view
- resets phase for the new round

## 7. Consensus Rules

### Weighted Quorum Rule

A decision is final only if votes supporting it have total weight **>= 2/3** of the active validator set.

### Leader Selection Rule

Leader selection is deterministic for a given height and view. Honest nodes must derive the same leader from the same validator set and view.

### View Change Logic

If progress fails within a bounded consensus window, nodes advance to the next view using valid timeout or view-change evidence.

### Finality Conditions

A state is final only when:

- the quorum rule is satisfied
- the proposal is valid
- no conflicting final state exists at the same height
- state roots are consistent

## 8. Adversary Model

The adversary may:

- delay messages
- reorder messages
- drop messages
- inject invalid messages

The adversary may not:

- forge signatures
- violate cryptographic assumptions

### Probabilistic Scheduler Model

The adversary is modeled as a probabilistic scheduler that controls delivery timing and ordering of messages subject to the protocol’s cryptographic verification rules. Invalid messages must be rejected.

## 9. Invariants

### Safety

No two conflicting finalized states may exist at the same height.

### Liveness

Under honest majority assumptions and continued message delivery, eventual finalization must occur.

### Determinism

Identical input traces must produce identical final states.

### Quorum Correctness

Finalization is valid only when the supporting vote weight is at least 2/3.

## 10. Trace Model

A trace is an ordered list of records:

```text
Trace = [
  { event, stateBefore, stateAfter, signatures }
]
```

A trace must be:

- deterministic
- replayable
- verifiable

## 11. Implementation Mapping

The specification maps to implementation as follows:

- **state machine** → BFT engine
- **SMT/MMR** → state storage layer
- **network layer** → gossip system
- **simulator** → adversarial environment
- **verifier** → invariant checker

The implementation is reference only. The specification is canonical.

## 12. Limitations

- not formally verified
- simulation-based validation only
- adversarial model is bounded
- real-world deployment requires additional auditing

## 13. Versioning Rules

- changes must increment protocol version
- breaking changes require a new RFC version
- behavior changes must preserve invariants or be explicitly versioned

## 14. Canonical Status

This document is the canonical protocol reference for NDAP v1.0. Independent implementations MUST conform to the rules, invariants, and trace semantics defined here.
