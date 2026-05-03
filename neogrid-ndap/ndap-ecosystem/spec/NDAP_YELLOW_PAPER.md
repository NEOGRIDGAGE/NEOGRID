# NDAP Yellow Paper

This document is the canonical NDAP protocol specification and the single source of truth for protocol behavior.

## Core Contents
- formal state machine
- invariants
- adversary model
- consensus rules
- trace model

## Canonical Status
NDAP is defined here as a protocol specification ecosystem, not as a single implementation.

## State Machine
NDAP clients MUST implement the protocol state machine specified by the RFC and this Yellow Paper.

## Invariants
- safety
- liveness
- determinism
- quorum correctness

## Adversary Model
- delay
- reorder
- drop
- invalid injection

## Consensus Rules
- weighted quorum
- deterministic leader selection
- view changes
- finality conditions

## Trace Model
- ordered
- replayable
- verifiable
