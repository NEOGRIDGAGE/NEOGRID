# NDAP Yellow Paper

This document is the single source of truth for NDAP.

## Formal State Machine
NDAP defines a deterministic consensus state machine with explicit transitions for proposal, voting, finalization, timeout, and view change.

## Consensus Rules
- weighted quorum governs finality
- leader selection is deterministic per height and view
- state transitions are only valid when preconditions are met

## Quorum Logic
Finalization requires at least 2/3 weighted support from the active validator set.

## Adversary Model
The network is asynchronous and adversarial. The adversary may delay, reorder, drop, or inject invalid messages, but may not forge valid signatures.

## Invariants
- safety
- liveness
- determinism
- quorum correctness

## Execution Semantics
All honest nodes must converge on the same final state when given the same ordered trace and valid inputs.
