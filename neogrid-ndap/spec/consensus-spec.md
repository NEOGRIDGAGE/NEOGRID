# Consensus Specification

## BFT Phases

- propose
- prevote
- precommit
- finalize

## Leader Selection Function

Leader selection is deterministic from height and view.

## Validator Weight Function

w(v) = stake(v) × reputation(v)

## Fork Resolution Rule

Under network partition, the branch with valid ≥ 2/3 weighted quorum and valid finality evidence is selected.

## Consensus Properties

- deterministic transitions
- quorum-based finalization
- view-change recovery
- fork resolution by weighted quorum
