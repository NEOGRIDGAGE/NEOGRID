const { serializeMessage } = require('./message');

class PeerManager {
  constructor() {
    this._peers = new Map(); // ws -> { id, url, connectedAt }
  }

  addPeer(ws, meta = {}) {
    this._peers.set(ws, {
      id:          meta.id || null,
      url:         meta.url || null,
      connectedAt: Date.now(),
    });
  }

  removePeer(ws) {
    this._peers.delete(ws);
  }

  setPeerId(ws, id) {
    const meta = this._peers.get(ws);
    if (meta) meta.id = id;
  }

  getPeers() {
    return Array.from(this._peers.keys());
  }

  getPeerMeta(ws) {
    return this._peers.get(ws) || null;
  }

  count() {
    return this._peers.size;
  }

  broadcast(message, excludeWs = null) {
    const raw = typeof message === 'string' ? message : serializeMessage(message);
    let sent = 0;
    for (const ws of this._peers.keys()) {
      if (ws === excludeWs) continue;
      if (ws.readyState === 1) { // OPEN
        ws.send(raw);
        sent++;
      }
    }
    return sent;
  }

  send(ws, message) {
    if (ws.readyState === 1) {
      ws.send(typeof message === 'string' ? message : serializeMessage(message));
      return true;
    }
    return false;
  }
}

module.exports = { PeerManager };
