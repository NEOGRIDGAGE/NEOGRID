const { BinarySMT } = require('../src/smt');
const { LinkedMMR } = require('../src/mmr');
const { Engine } = require('../src/engine');
const { createTransaction, canonicalize } = require('../src/tx');
const { zkPipeline } = require('../src/zk');
const { hashData } = require('../src/utils');

const ITERATIONS = 200;

function timer(label, fn, n = ITERATIONS) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn(i);
  const end = process.hrtime.bigint();
  const totalMs = Number(end - start) / 1e6;
  const perOp = (totalMs / n).toFixed(4);
  console.log(`  ${label.padEnd(38)} ${totalMs.toFixed(2).padStart(8)} ms total | ${perOp} ms/op (n=${n})`);
  return totalMs;
}

async function timerAsync(label, fn, n = ITERATIONS) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < n; i++) await fn(i);
  const end = process.hrtime.bigint();
  const totalMs = Number(end - start) / 1e6;
  const perOp = (totalMs / n).toFixed(4);
  console.log(`  ${label.padEnd(38)} ${totalMs.toFixed(2).padStart(8)} ms total | ${perOp} ms/op (n=${n})`);
  return totalMs;
}

async function main() {
  console.log('=== NDAP ENTERPRISE BENCHMARK SUITE ===');
  console.log(`Iterations per benchmark: ${ITERATIONS}\n`);

  console.log('[ SHA-256 Hashing ]');
  timer('hashData(string)', (i) => hashData(`benchmark-data-${i}`));

  console.log('\n[ Sparse Merkle Tree ]');
  const smtInsert = new BinarySMT();
  const keys = Array.from({ length: ITERATIONS }, (_, i) => hashData(`smt-key-${i}`));
  let ki = 0;
  timer('SMT.set(key, value)', () => { smtInsert.set(keys[ki++], `val-${ki}`); });

  timer('SMT.computeRoot() [500-leaf tree]', () => smtInsert.computeRoot(), 20);

  const smtProof = new BinarySMT();
  const proofKeys = [];
  for (let i = 0; i < 10; i++) {
    const k = hashData(`proof-key-${i}`);
    smtProof.set(k, `owner-${i}`);
    proofKeys.push(k);
  }
  timer('SMT.getProof(key) [10-leaf tree]', (i) => smtProof.getProof(proofKeys[i % proofKeys.length]), 20);

  const proofs = proofKeys.map(k => smtProof.getProof(k));
  timer('SMT.verifyProof(proof)', (i) => smtProof.verifyProof(proofs[i % proofs.length]), 50);

  console.log('\n[ Merkle Mountain Range ]');
  const mmr = new LinkedMMR();
  timer('MMR.append(data)', (i) => mmr.append(`entry-${i}`));
  timer('MMR.verify() [500-entry log]', () => mmr.verify());

  console.log('\n[ Transaction Processing ]');
  const makeTxFields = (i) => ({
    fromDID: `did:neogrid:alice-${i}`,
    toDID: `did:neogrid:bob-${i}`,
    assetId: hashData(`asset-${i}`),
    amount: i % 100,
    nonce: `nonce-bench-${i}-${Date.now()}`,
    timestamp: Date.now(),
  });

  timer('createTransaction(fields)', (i) => createTransaction(makeTxFields(i)));
  timer('canonicalize(object)', (i) => canonicalize({ a: i, b: 'hello', c: { nested: true } }));

  console.log('\n[ ZK Pipeline ]');
  const zkTx = createTransaction(makeTxFields(0));
  timer('zkPipeline(tx, balance) — sufficient', (i) => {
    const tx = createTransaction(makeTxFields(i));
    return zkPipeline(tx, 10000);
  });
  timer('zkPipeline(tx, balance) — insufficient', (i) => {
    const tx = createTransaction(makeTxFields(i));
    return zkPipeline(tx, 0);
  });

  console.log('\n[ Engine — Full Transaction Flow ]');
  const engine = new Engine();
  await timerAsync('Engine.apply_transaction(tx)', async (i) => {
    const tx = createTransaction(makeTxFields(i));
    engine.apply_transaction(tx);
  });

  await timerAsync('Engine.register_asset()', async (i) => {
    const engine2 = new Engine();
    await engine2.register_asset(`bench-asset-${i}`, `did:neogrid:owner-${i}`, { i });
  }, 50);

  console.log('\n[ State Root Computation ]');
  const bigSmt = new BinarySMT();
  for (let i = 0; i < 100; i++) bigSmt.set(hashData(`big-key-${i}`), `val-${i}`);
  timer('SMT.computeRoot() [100-leaf tree]', () => bigSmt.computeRoot());

  const bigEngine = new Engine();
  for (let i = 0; i < 20; i++) {
    bigEngine.apply_transaction(createTransaction(makeTxFields(i)));
  }
  timer('Engine.compute_state_root() [20-tx state]', () => bigEngine.compute_state_root());

  console.log('\n=== BENCHMARK COMPLETE ===');
}

main().catch(err => { console.error(err); process.exit(1); });
