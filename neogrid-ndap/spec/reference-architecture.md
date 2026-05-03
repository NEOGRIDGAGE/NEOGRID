# Reference Architecture

## NeoGrid Node Architecture

- Execution Layer: transaction processing + state transitions
- Consensus Layer: BFT + validator coordination
- Storage Layer: SMT/MMR + persistence

## API Mapping

- /data → execution entrypoint
- /transfer → transaction flow handler
- /verify → state proof verification
- /log → observability layer
- /snapshot → state inspection layer

## System Mapping

- Node.js → API + orchestration layer
- Rust core → execution + cryptographic core
- IPFS → distributed storage layer
- ZK placeholder → future verification expansion layer
