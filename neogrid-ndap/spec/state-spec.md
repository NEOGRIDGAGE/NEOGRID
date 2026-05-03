# State Specification

## State Model

State includes SMT and MMR roots plus consensus metadata.

## State Transition Constraints

- transitions must be deterministic
- only valid transactions may mutate state
- finalized state is immutable

## Immutability Rules

A finalized state cannot be replaced by a conflicting finalized state at the same height.

## Conflict Resolution Invariants

- no double finalization
- no divergent finalized roots at the same height
- valid quorum required for finality
