# Protocol Invariants

- Safety: no two conflicting FINALIZED_STATE entries at the same height.
- Liveness: eventual finality under partial synchrony.
- Determinism: identical inputs produce identical stateRoot.
- Validator Consistency: all nodes agree on validator set per epoch.
