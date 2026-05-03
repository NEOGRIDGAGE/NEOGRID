# WASM Client Interface

A compliant WASM client should provide:
- `applyEvent`
- `getState`
- `sendMessage`
- `receiveMessage`
- `propose`
- `vote`
- `finalize`

The host environment is responsible for message transport and trace replay.
