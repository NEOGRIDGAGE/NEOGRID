const express = require('express');
const bodyParser = require('body-parser');
const { Engine } = require('./src/engine');
const { createTransaction, canonicalize } = require('./src/tx');
const { generateDID } = require('./src/did');
const { zkPipeline } = require('./src/zk');
const { canonicalHash } = require('./src/ipfs');
const { randomHex } = require('./src/utils');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '1mb' }));

const engine = new Engine();

app.post('/data', async (req, res) => {
  try {
    const { data, owner } = req.body;
    if (!data) return res.status(400).json({ error: 'data is required' });
    if (!owner) return res.status(400).json({ error: 'owner is required' });

    const assetId = canonicalHash(data);
    const result = await engine.register_asset(assetId, owner, data);

    return res.json({
      key: assetId,
      cid: result.cid,
      root: result.root,
      logIndex: result.logEntry.index,
      mmrRoot: engine.get_mmr_root(),
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
      amount: amount || 0,
      nonce: nonce || randomHex(8),
      timestamp: Date.now(),
    });

    const zkResult = zkPipeline(tx, balance !== undefined ? balance : Infinity);
    if (!zkResult.ok) {
      return res.status(400).json({ error: `ZK proof failed: ${zkResult.error}`, code: 'ZK_REJECTED' });
    }

    const transition = engine.apply_transaction(tx);

    return res.json({
      success: true,
      tx,
      prevRoot: transition.prevRoot,
      newRoot: transition.newRoot,
      txHash: transition.txHash,
      logIndex: transition.logEntry.index,
      mmrRoot: engine.get_mmr_root(),
      zkProof: zkResult.proof.proof,
    });
  } catch (err) {
    return res.status(err.message.includes('rejected') ? 403 : 500).json({ error: err.message });
  }
});

app.post('/verify', (req, res) => {
  try {
    const { key, proof: clientProof } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const smtProof = engine.get_proof(key);
    const proofValid = engine.verify_proof(smtProof);

    let txValid = null;
    if (clientProof) {
      txValid = engine.verify_proof(clientProof);
    }

    return res.json({
      valid: proofValid && (txValid === null || txValid),
      smtProof,
      stateRoot: engine.compute_state_root(),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/log', (req, res) => {
  try {
    const log = engine.get_log();
    const integrity = engine.verify_log_integrity();
    return res.json({
      log,
      count: log.length,
      mmrRoot: engine.get_mmr_root(),
      integrity,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/snapshot', (req, res) => {
  try {
    return res.json(engine.snapshot());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('NDAP ENTERPRISE CORE ACTIVE');
  console.log(`NeoGrid VDAP v2 running on port ${PORT} | Rust engine: ${engine.rustAvailable()}`);
});

module.exports = app;
