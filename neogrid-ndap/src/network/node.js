const WebSocket = require('ws');
const { PeerManager }  = require('./peer');
const { GossipLayer }  = require('./gossip');
const { SyncProtocol } = require('./sync');
const { validate }     = require('./validator');
const { parseMessage, createMessage, MESSAGE_TYPES } = require('./message');

class NetworkNode {
  constructor({ nodeId, wsPort, engine }) {
    this._nodeId     = nodeId;
    this._wsPort     = wsPort;
    this._engine     = engine;
    this._consensus  = null;
    this._peers      = new PeerManager();
    this._gossip     = new GossipLayer(this._peers);
    this._sync       = new SyncProtocol(nodeId, engine, this._peers);
    this._wss        = null;
    this._handlers   = this._buildHandlers();
  }

  setConsensus(consensus) {
    this._consensus = consensus;
    this._handlers  = this._buildHandlers();
  }

  _buildHandlers() {
    return {
      [MESSAGE_TYPES.STATE_UPDATE]: (msg) => {
        try {
          validate(msg, this._engine);
          const { smtRoot, mmrRoot } = msg.payload;
          console.log(`[NET] STATE_UPDATE from ${msg.nodeId.slice(0, 8)}… smtRoot=${smtRoot.slice(0, 12)}…`);
        } catch (err) { console.warn(`[NET] Invalid STATE_UPDATE: ${err.message}`); }
      },

      [MESSAGE_TYPES.TRANSACTION_BROADCAST]: (msg) => {
        try {
          validate(msg, this._engine);
          console.log(`[NET] TX_BROADCAST txHash=${(msg.payload.txHash || '').slice(0, 12)}…`);
        } catch (err) { console.warn(`[NET] Invalid TX_BROADCAST: ${err.message}`); }
      },

      [MESSAGE_TYPES.SYNC_REQUEST]: (msg, senderWs) => {
        try {
          validate(msg, this._engine);
          this._sync.handleSyncRequest(senderWs, msg);
        } catch (err) { console.warn(`[NET] Invalid SYNC_REQUEST: ${err.message}`); }
      },

      [MESSAGE_TYPES.SYNC_RESPONSE]: (msg) => {
        try {
          validate(msg, this._engine);
          this._sync.handleSyncResponse(msg);
        } catch (err) { console.warn(`[NET] Invalid SYNC_RESPONSE: ${err.message}`); }
      },

      [MESSAGE_TYPES.PROOF_REQUEST]: (msg, senderWs) => {
        try {
          const { key } = msg.payload || {};
          if (!key) return;
          const proof = this._engine.get_proof(key);
          this._peers.send(senderWs, createMessage(MESSAGE_TYPES.PROOF_RESPONSE, this._nodeId, { key, proof }));
        } catch (err) { console.warn(`[NET] PROOF_REQUEST error: ${err.message}`); }
      },

      [MESSAGE_TYPES.PROOF_RESPONSE]: (msg) => {
        console.log(`[NET] PROOF_RESPONSE from ${msg.nodeId.slice(0, 8)}…`);
      },

      [MESSAGE_TYPES.STATE_PROPOSE]: (msg) => {
        if (!this._consensus) return;
        const result = this._consensus.handlePropose(msg.payload);
        if (result) this.broadcastRaw(this._wrapConsensusMsg(result));
      },

      [MESSAGE_TYPES.VOTE_PREVOTE]: (msg) => {
        if (!this._consensus) return;
        const result = this._consensus.handlePrevote(msg.payload);
        if (result && !result.finalized) this.broadcastRaw(this._wrapConsensusMsg(result));
      },

      [MESSAGE_TYPES.VOTE_PRECOMMIT]: (msg) => {
        if (!this._consensus) return;
        this._consensus.handlePrecommit(msg.payload);
      },

      [MESSAGE_TYPES.FINALIZED_STATE]: (msg) => {
        const s = msg.payload || {};
        console.log(`[BFT] Received FINALIZED_STATE height=${s.height} from ${msg.nodeId.slice(0, 8)}…`);
      },

      [MESSAGE_TYPES.VIEW_CHANGE]: (msg) => {
        if (!this._consensus) return;
        const p = msg.payload || msg;
        console.log(`[BFT] VIEW_CHANGE from ${msg.nodeId.slice(0, 8)}… view=${p.view}`);
        this._consensus.handleViewChange({ ...p, height: p.height, view: p.view });
      },
    };
  }

  _wrapConsensusMsg(msg) {
    return {
      type:      msg.type,
      nodeId:    this._nodeId,
      timestamp: msg.timestamp || Date.now(),
      signature: msg.signature || null,
      payload:   msg,
    };
  }

  _attachSocket(ws, meta = {}) {
    this._peers.addPeer(ws, meta);

    ws.on('message', (raw) => {
      let msg;
      try { msg = parseMessage(raw); } catch (err) {
        console.warn(`[NET] Parse error: ${err.message}`); return;
      }
      this._peers.setPeerId(ws, msg.nodeId);
      this._gossip.receive(msg, ws, this._handlers);
    });

    ws.on('close', () => {
      console.log(`[NET] Peer disconnected (${meta.url || 'inbound'})`);
      this._peers.removePeer(ws);
    });

    ws.on('error', (err) => {
      console.warn(`[NET] Peer error: ${err.message}`);
      this._peers.removePeer(ws);
    });
  }

  start() {
    this._wss = new WebSocket.Server({ port: this._wsPort });
    this._wss.on('connection', (ws) => {
      console.log(`[NET] Inbound peer connected (total: ${this._peers.count() + 1})`);
      this._attachSocket(ws);
      this._sync.sendSyncRequest(ws);
    });
    this._wss.on('error', (err) => console.error(`[NET] WS Server error: ${err.message}`));
    console.log(`[NET] WebSocket server listening on ws://0.0.0.0:${this._wsPort}`);
  }

  connectToPeer(url) {
    const ws = new WebSocket(url);
    ws.on('open', () => {
      console.log(`[NET] Connected to peer ${url}`);
      this._attachSocket(ws, { url });
      this._sync.sendSyncRequest(ws);
    });
    ws.on('error', (err) => console.warn(`[NET] Could not connect to ${url}: ${err.message}`));
  }

  broadcastStateUpdate(smtRoot, mmrRoot) {
    const msg = createMessage(MESSAGE_TYPES.STATE_UPDATE, this._nodeId, { smtRoot, mmrRoot });
    this._gossip.markSeen(msg);
    this._peers.broadcast(msg);
  }

  broadcastTransaction(tx, txHash) {
    const msg = createMessage(MESSAGE_TYPES.TRANSACTION_BROADCAST, this._nodeId, { tx, txHash });
    this._gossip.markSeen(msg);
    this._peers.broadcast(msg);
  }

  broadcastRaw(msg) {
    this._gossip.markSeen(msg);
    this._peers.broadcast(msg);
  }

  peerCount() { return this._peers.count(); }
  nodeId()    { return this._nodeId; }
}

module.exports = { NetworkNode };
