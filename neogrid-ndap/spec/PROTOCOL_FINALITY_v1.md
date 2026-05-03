# NDAP Protocol Finality v1

## Finality
A state is final when:
- >= 2/3 weighted PRECOMMIT votes
- all signatures are valid
- deterministic execution is confirmed
- SMT root == MMR derived state root

## Core Integrity Verified Layer
- consensus engine behavior
- validator weighting rules
- leader selection algorithm
- state transition rules

## Not Allowed To Change
- quorum formula
- BFT phase order
- identity system
- SMT/MMR structures
- execution engine determinism rules
