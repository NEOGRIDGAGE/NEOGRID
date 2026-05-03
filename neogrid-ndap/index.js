const express    = require('express');
const bodyParser = require('body-parser');
const { Engine } = require('./src/engine');
const { createTransaction } = require('./src/tx');
const { zkPipeline }        = require('./src/zk');
const { canonicalHash }     = require('./src/ipfs');
const { randomHex }         = require('./src/utils');
const { initNetwork }       = require('./src/network/index');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '1mb' }));

const engine  = new Engine();

console.log('NDAP ENTERPRISE CORE ACTIVE');
console.log('NDAP DISTRIBUTED NODE STARTED');

const network = initNetwork(engine);

app.post('/data', async (req, res) => {
  try {
    const { data, owner } = req.body;
    if (!data)  return res.status(400).json({ error: 'data is required' });
    if (!owner) return res.status(400).json({ error: 'owner is required' });

    const assetId = canonicalHash(data);
    const result  = await engine.register_asset(assetId, owner, data);
    const smtRoot = engine.compute_state_root();
    const mmrRoot = engine.get_mmr_root();

    network.broadcastStateUpdate(smtRoot, mmrRoot);
    const finalizedState = network.triggerConsensus(smtRoot, mmrRoot);

    return res.json({
      key:      assetId,
      cid:      result.cid,
      root:     result.root,
      logIndex: result.logEntry.index,
      mmrRoot,
      nodeId:   network.nodeId(),
      peers:    network.peerCount(),
      consensus: finalizedState
        ? { height: finalizedState.height, finalized: true, commitSigs: finalizedState.commitCert.length }
        : { finalized: false },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/transfer', async (req, res) => {
  try {
    const { fromDID, toDID, assetId, amount, nonce, balance } = req.body;
    if (!fromDID || !toDID || !assetId) {
      return res.status(400).json({ error: 'fromDID, toDID, and assetId are required' });
    }

    const tx = createTransaction({
      fromDID,
      toDID,
      assetId,
      amount:    amount || 0,
      nonce:     nonce || randomHex(8),
      timestamp: Date.now(),
    });

    const zkResult = zkPipeline(tx, balance !== undefined ? balance : Infinity);
    if (!zkResult.ok) {
      return res.status(400).json({ error: `ZK proof failed: ${zkResult.error}`, code: 'ZK_REJECTED' });
    }

    const transition = engine.apply_transaction(tx);
    const smtRoot    = engine.compute_state_root();
    const mmrRoot    = engine.get_mmr_root();

    network.broadcastStateUpdate(smtRoot, mmrRoot);
    network.broadcastTransaction(tx, transition.txHash);
    const finalizedState = network.triggerConsensus(smtRoot, mmrRoot);

    return res.json({
      success:  true,
      tx,
      prevRoot: transition.prevRoot,
      newRoot:  transition.newRoot,
      txHash:   transition.txHash,
      logIndex: transition.logEntry.index,
      mmrRoot,
      zkProof:  zkResult.proof.proof,
      nodeId:   network.nodeId(),
      peers:    network.peerCount(),
      consensus: finalizedState
        ? { height: finalizedState.height, finalized: true, commitSigs: finalizedState.commitCert.length }
        : { finalized: false },
    });
  } catch (err) {
    return res.status(err.message.includes('rejected') ? 403 : 500).json({ error: err.message });
  }
});

app.post('/verify', (req, res) => {
  try {
    const { key, proof: clientProof } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const smtProof  = engine.get_proof(key);
    const proofValid = engine.verify_proof(smtProof);
    let txValid = null;
    if (clientProof) txValid = engine.verify_proof(clientProof);

    return res.json({
      valid:     proofValid && (txValid === null || txValid),
      smtProof,
      stateRoot: engine.compute_state_root(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/log', (req, res) => {
  try {
    const log       = engine.get_log();
    const integrity = engine.verify_log_integrity();
    return res.json({ log, count: log.length, mmrRoot: engine.get_mmr_root(), integrity });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/snapshot', (req, res) => {
  try {
    const cons      = network.consensus();
    const latest    = cons.getLatestFinalized();
    return res.json({
      ...engine.snapshot(),
      nodeId:   network.nodeId(),
      pubKey:   network.pubKeyHex().slice(0, 24) + '…',
      peers:    network.peerCount(),
      consensus: {
        height:       cons.height(),
        view:         cons.view(),
        phase:        cons.phase(),
        latestHeight: latest ? latest.height : null,
        finalized:    latest ? latest.finalized : false,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/peers', (req, res) => {
  const cons = network.consensus();
  return res.json({
    nodeId:        network.nodeId(),
    peers:         network.peerCount(),
    consensusView: { height: cons.height(), view: cons.view(), phase: cons.phase() },
  });
});

app.listen(PORT, () => {
  console.log(`NeoGrid VDAP v2 running on port ${PORT} | Rust engine: ${engine.rustAvailable()}`);
});

module.exports = app;
