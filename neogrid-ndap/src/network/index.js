const { v4: uuidv4 } = require('uuid');
const { NetworkNode } = require('./node');

let _instance = null;

function initNetwork(engine) {
  if (_instance) return _instance;

  const nodeId  = process.env.NODE_ID || uuidv4();
  const apiPort = parseInt(process.env.PORT || '3000', 10);
  const wsPort  = parseInt(process.env.WS_PORT || String(apiPort + 1000), 10);
  const peers   = (process.env.PEERS || '').split(',').map(s => s.trim()).filter(Boolean);

  const node = new NetworkNode({ nodeId, wsPort, engine });
  node.start();

  for (const url of peers) {
    node.connectToPeer(url);
  }

  console.log(`[NET] Node identity: ${nodeId}`);
  if (peers.length) {
    console.log(`[NET] Connecting to peers: ${peers.join(', ')}`);
  } else {
    console.log('[NET] No peers configured — running in standalone mode');
  }

  _instance = node;
  return node;
}

function getNetwork() {
  return _instance;
}

module.exports = { initNetwork, getNetwork };
