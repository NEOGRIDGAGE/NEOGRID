const { hashData } = require('./utils');
const { canonicalize } = require('./tx');

const ZK_VERSION = 'ndap-zk-v2';

function generateWitness(tx, balance) {
  const amount = tx.amount || 0;
  const valid = balance >= amount ? 1 : 0;
  return {
    balance,
    amount,
    nonce: hashData(String(tx.nonce)),
    valid,
    fromDID: tx.fromDID,
    assetId: tx.assetId,
    txHash: hashData(canonicalize({ fromDID: tx.fromDID, toDID: tx.toDID, assetId: tx.assetId, amount, nonce: tx.nonce, timestamp: tx.timestamp })),
  };
}

function generateProof(witness) {
  if (!witness.valid) {
    return { ok: false, error: 'Constraint violation: balance < amount', witness };
  }
  const proofData = hashData(`${ZK_VERSION}:${witness.txHash}:${witness.balance}:${witness.amount}:${witness.nonce}`);
  return {
    ok: true,
    proof: proofData,
    publicInputs: {
      amount: witness.amount,
      txHash: witness.txHash,
      valid: witness.valid,
    },
    version: ZK_VERSION,
    generatedAt: Date.now(),
  };
}

function verifyProof(proof, publicInputs) {
  if (!proof || !proof.ok || !proof.proof) return { valid: false, error: 'No valid proof object' };
  if (proof.version !== ZK_VERSION) return { valid: false, error: `Version mismatch: expected ${ZK_VERSION}` };

  if (publicInputs) {
    if (publicInputs.txHash && proof.publicInputs.txHash !== publicInputs.txHash) {
      return { valid: false, error: 'txHash mismatch in public inputs' };
    }
    if (proof.publicInputs.valid !== 1) {
      return { valid: false, error: 'ZK constraint not satisfied' };
    }
  }

  const age = Date.now() - proof.generatedAt;
  if (age > 60_000) return { valid: false, error: 'Proof expired (>60s)' };

  return { valid: proof.publicInputs.valid === 1, proof: proof.proof };
}

function zkPipeline(tx, balance) {
  const witness = generateWitness(tx, balance);
  const proof = generateProof(witness);
  if (!proof.ok) return { ok: false, error: proof.error };
  const verification = verifyProof(proof, proof.publicInputs);
  if (!verification.valid) return { ok: false, error: verification.error };
  return { ok: true, proof, verification };
}

module.exports = { generateWitness, generateProof, verifyProof, zkPipeline };
