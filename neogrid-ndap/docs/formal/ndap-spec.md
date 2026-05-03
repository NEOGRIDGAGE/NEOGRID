# NDAP Formal Protocol Specification v1.0

## System Model
- Nodes are deterministic state machines.
- Network is asynchronous, unreliable, and adversarial.
- Messages are signed, ordered per sender, and not globally ordered.

## Trust Model
- Byzantine nodes exist.
- Up to 1/3 of nodes may be malicious.
- All consensus messages require valid signatures.

## State Model
Canonical state:

State = {
  height,
  view,
  validatorSet,
  smtRoot,
  mmrRoot,
  finalizedStateRoot
}

## Execution Semantics
- Proposal, vote, timeout, and view change events advance state deterministically.
- Finalization requires valid quorum and consistent roots.
- Replays of identical ordered events must yield identical final state.

## Adversary Model
- Adversary controls delivery scheduling.
- Allowed actions: delay, reorder, drop, equivocate attempts, fake injection.
- Invalid signatures must be rejected.
- Cryptographic primitives cannot be broken.
