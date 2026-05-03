const express = require('express');
const bodyParser = require('body-parser');
const { hashData } = require('./src/utils');
const { SMT } = require('./src/smt');
const { MMR } = require('./src/mmr');
const { generateDID } = require('./src/did');
const { createTransaction, verifyTransaction } = require('./src/tx');
const { uploadToIPFS } = require('./src/ipfs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const smt = new SMT();
const mmr = new MMR();
const ownershipMap = {};

app.post('/data', async (req, res) => {
  try {
    const { data, owner } = req.body;
    if (!data) return res.status(400).json({ error: 'data is required' });

    const key = hashData(JSON.stringify(data));
    const cid = await uploadToIPFS(data);
    smt.set(key, cid);
    const root = smt.computeRoot();
    const logIndex = mmr.append(cid);

    if (owner) ownershipMap[key] = owner;

    return res.json({ key, cid, root, logIndex });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/transfer', async (req, res) => {
  try {
    const { key, from, to } = req.body;
    if (!key || !from || !to) return res.status(400).json({ error: 'key, from, and to are required' });

    const currentOwner = ownershipMap[key];
    if (!currentOwner || currentOwner !== from) {
      return res.status(403).json({ error: 'Ownership validation failed' });
    }

    const tx = createTransaction({ key, from, to, timestamp: Date.now() });
    ownershipMap[key] = to;

    const logEntry = hashData(JSON.stringify(tx));
    const logIndex = mmr.append(logEntry);
    const root = smt.computeRoot();

    return res.json({ success: true, tx, logIndex, root });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/verify', (req, res) => {
  try {
    const { key, proof } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const smtProof = smt.getProof(key);
    const valid = smtProof.exists;

    if (proof) {
      const txValid = verifyTransaction(proof);
      return res.json({ valid: valid && txValid, smtProof });
    }

    return res.json({ valid, smtProof });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/log', (req, res) => {
  try {
    const log = mmr.getAll();
    return res.json({ log, count: log.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('NDAP READY');
  console.log(`NeoGrid NDAP server running on port ${PORT}`);
});

module.exports = app;
