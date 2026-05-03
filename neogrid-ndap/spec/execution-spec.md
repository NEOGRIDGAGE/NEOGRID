# Execution Specification

## Deterministic State Transition

S(n+1) = F(S(n), TxBatch, ValidatorSet)

## State Model

State S contains:
- height
- view
- validatorSet
- smtRoot
- mmrRoot
- finalizedRoot
- phase

## Transaction Validity Rules

A transaction is valid only if:
- signature is valid under Ed25519
- replay protection passes
- ordering constraints are satisfied
- the transaction is not malformed

## Execution Function F()

F(S, T, V) deterministically applies an ordered batch of transactions T to state S under validator set V.

## Deterministic Ordering Rules

- all valid transactions are ordered deterministically
- identical inputs must produce identical execution order
- ordering must not depend on nondeterministic arrival timing

## Finality Condition

A state is final only if it is committed by at least 2/3 weighted quorum.

## Mathematical Model

- V = set of validators
- w(v) = stake(v) × reputation(v)
- Q = Σw(v) ≥ 2/3 ΣV
- S' = F(S, T)

A state is final if it is committed by ≥ 2/3 weighted quorum and cannot be reverted under any valid fork-choice rule.
