const { createMessage, MESSAGE_TYPES } = require('./message');

class SyncProtocol {
  constructor(nodeId, engine, peers) {
    this._nodeId = nodeId;
    this._engine = engine;
    this._peers  = peers;
  }

  sendSyncRequest(ws) {
    const lastKnownRoot = this._engine.compute_state_root();
    const msg = createMessage(MESSAGE_TYPES.SYNC_REQUEST, this._nodeId, {
      lastKnownRoot,
    });
    this._peers.send(ws, msg);
  }

  handleSyncRequest(ws, msg) {
    const log    = this._engine.get_log();
    const recent = log.slice(-50);
    const reply  = createMessage(MESSAGE_TYPES.SYNC_RESPONSE, this._nodeId, {
      stateRoot:  this._engine.compute_state_root(),
      mmrRoot:    this._engine.get_mmr_root(),
      recentLogs: recent,
    });
    this._peers.send(ws, reply);
  }

  handleSyncResponse(msg) {
    const { stateRoot, mmrRoot, recentLogs } = msg.payload;
    const localRoot = this._engine.compute_state_root();
    const localMMR  = this._engine.get_mmr_root();

    if (stateRoot === localRoot && mmrRoot === localMMR) return;

    const integrity = this._engine.verify_log_integrity();
    console.log(
      `[SYNC] Remote root ${stateRoot.slice(0, 12)}… ` +
      `local ${localRoot.slice(0, 12)}… ` +
      `log integrity: ${integrity.valid}`
    );
  }

  requestResync() {
    for (const ws of this._peers.getPeers()) {
      this.sendSyncRequest(ws);
    }
  }
}

module.exports = { SyncProtocol };
