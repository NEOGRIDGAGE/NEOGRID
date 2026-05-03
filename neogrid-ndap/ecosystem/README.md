# How to Build on NeoGrid NDAP

NDAP is a stable reference protocol with explicit module boundaries.

## Extension Rules
- Do not modify core consensus.
- Extend only via new modules.
- Preserve state transition invariants.
- Validate all contributions through the simulator layer.

## Safe Extension Guidelines
- Keep execution deterministic.
- Keep validation explicit.
- Keep protocol and extension layers separated.
