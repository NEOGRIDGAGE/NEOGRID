const { v4: uuidv4 }  = require('uuid');
const { NetworkNode } = require('./node');
const { generateIdentity, ValidatorSet, BFTConsensus } = require('../consensus/index');

let _instance = null;

class NetworkFacade {
  constructor(node, consensus, identity) {
    this._node      = node;
    this._consensus = consensus;
    this._identity  = identity;
  }

  broadcastStateUpdate(smtRoot, mmrRoot) {
    this._node.broadcastStateUpdate(smtRoot, mmrRoot);
  }

  broadcastTransaction(tx, txHash) {
    this._node.broadcastTransaction(tx, txHash);
  }

  // Run a BFT consensus round for the current state roots.
  // Returns the finalizedState if consensus completes synchronously (single-node),
  // or null if waiting for peer votes (multi-node).
  triggerConsensus(smtRoot, mmrRoot) {
    try {
      return this._consensus.startRound(smtRoot, mmrRoot);
    } catch (err) {
      console.warn(`[BFT] startRound error: ${err.message}`);
      return null;
    }
  }

  peerCount()  { return this._node.peerCount(); }
  nodeId()     { return this._identity.nodeId; }
  pubKeyHex()  { return this._identity.pubKeyHex; }
  consensus()  { return this._consensus; }
}

function initNetwork(engine) {
  if (_instance) return _instance;

  const identity = generateIdentity();
  const nodeId   = identity.nodeId;
  const apiPort  = parseInt(process.env.PORT   || '3000', 10);
  const wsPort   = parseInt(process.env.WS_PORT || String(apiPort + 1000), 10);
  const peers    = (process.env.PEERS || '').split(',').map(s => s.trim()).filter(Boolean);

  const validators = new ValidatorSet();
  validators.addValidator({
    nodeId:     identity.nodeId,
    stake:      100,
    reputation: 1,
    pubKeyHex:  identity.pubKeyHex,
  });

  const node = new NetworkNode({ nodeId, wsPort, engine });
  node.start();

  const consensus = new BFTConsensus({ identity, validators, timeout: 30_000 });

  consensus.on('broadcast', (msg) => {
    node.broadcastRaw({
      type:      msg.type,
      nodeId:    identity.nodeId,
      timestamp: msg.timestamp || Date.now(),
      signature: msg.signature || null,
      payload:   msg,
    });
  });

  consensus.on('finalized', (state) => {
    console.log(`[BFT] FINALIZED height=${state.height} smtRoot=${state.smtRoot.slice(0, 12)}… commitCert=${state.commitCert.length} sig(s)`);
  });

  consensus.on('viewChange', ({ height, view, reason }) => {
    console.log(`[BFT] VIEW_CHANGE height=${height} view=${view} reason=${reason}`);
  });

  node.setConsensus(consensus);

  for (const url of peers) node.connectToPeer(url);

  console.log(`[NET] Node identity: ${nodeId}`);
  console.log(`[NET] Ed25519 pubKey: ${identity.pubKeyHex.slice(0, 24)}…`);
  if (peers.length) console.log(`[NET] Connecting to peers: ${peers.join(', ')}`);
  else              console.log('[NET] No peers configured — running in standalone mode');

  _instance = new NetworkFacade(node, consensus, identity);
  return _instance;
}

function getNetwork() { return _instance; }

module.exports = { initNetwork, getNetwork };
