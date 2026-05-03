# NDAP Client Specification

All NDAP clients MUST implement the following interfaces.

## State Machine Interface
- `applyEvent()`
- `getState()`

## Networking Interface
- `sendMessage()`
- `receiveMessage()`

## Consensus Interface
- `propose()`
- `vote()`
- `finalize()`

Clients MUST be interchangeable and produce equivalent outcomes under the same input trace.
