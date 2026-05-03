# Transaction Specification

## Transaction Structure

A transaction contains:
- sender
- recipient
- asset reference
- nonce
- signature
- payload

## Signature Verification Rules

- signatures use Ed25519
- signatures must verify before execution

## Replay Protection Model

- nonces must be unique per sender
- previously accepted nonces must be rejected

## Invalid Transaction Rejection Rules

Reject if:
- signature invalid
- nonce reused
- payload malformed
- ordering constraints fail

## Ordering Constraints

Transactions must be ordered deterministically before execution.
