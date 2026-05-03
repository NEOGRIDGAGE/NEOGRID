# Protocol Specification

## System Definition

NDAP is a deterministic distributed protocol with explicit execution, consensus, validator, transaction, and state models.

## Extension Rules

- Core consensus cannot be modified.
- Only new modules can extend behavior.
- All extensions must respect state transition invariants.
- All external contributions must pass simulator validation.

## Execution Model

S(n+1) = F(S(n), T, V)

## Consensus Model

NDAP uses a weighted BFT lifecycle with quorum-based finality.

## Validator Model

Validators are weighted by stake and reputation.

## Transaction Lifecycle

Transactions are validated, ordered, executed, and finalized deterministically.

## State Transition Rules

State transitions must be deterministic, replayable, and invariant-preserving.
