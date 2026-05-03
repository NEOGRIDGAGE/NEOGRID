const path = require('path');
const { SimulatedNode }   = require(path.join(__dirname, '../nodes/simulatedNode'));
const { NetworkEmulator } = require(path.join(__dirname, '../network/emulator'));
const { ValidatorSet }    = require(path.join(__dirname, '../../src/consensus/validator'));
const { ProtocolChecker } = require(path.join(__dirname, '../validator/checker'));

async function run() {
  const result = { scenario: 'networkPartition', pass: false, detail: '', convergenceMs: null };
  const start  = Date.now();

  const vs    = new ValidatorSet();
  const nodes = [];

  for (let i = 0; i < 6; i++) {
    const n = new SimulatedNode({ nodeIndex: i, timeout: 3000 });
    vs.addValidator({ nodeId: n.nodeId, stake: 100, reputation: 1, pubKeyHex: n.identity.pubKeyHex });
    nodes.push(n);
  }
  for (const n of nodes) {
    n.validators = vs;
    n.bft._validators = vs;
  }

  const emulator = new NetworkEmulator();
  for (const n of nodes) emulator.register(n);

  // ── Phase 1: healthy — leader proposes and all 6 nodes finalize ───────────
  const leader = nodes.find((n) => vs.getLeader(0, 0) === n.nodeId) || nodes[0];
  leader.proposeState('pre-partition-root', 'pre-partition-mmr');
  await sleep(400);
  emulator.flush();
  await sleep(100);

  const prePartitionHeight = leader.finalized.length ? leader.finalized[leader.finalized.length - 1].height : 0;

  // ── Phase 2: partition into 2 groups ──────────────────────────────────────
  const groupA = nodes.slice(0, 2).map((n) => n.nodeId);  // minority: 2/6
  const groupB = nodes.slice(2).map((n) => n.nodeId);     // majority: 4/6
  emulator.partitionNetwork([groupA, groupB]);

  // Group A (minority) cannot reach quorum — proposals should stall
  const aLeader = nodes.find((n) => groupA.includes(n.nodeId));
  if (aLeader) aLeader.proposeState('partition-a-root', 'partition-a-mmr');

  // Group B (majority, 4/6 > 2/3) can finalize
  const bLeader = nodes.find((n) =>
    groupB.includes(n.nodeId) && vs.getLeader(nodes[0].bft.height(), 0) === n.nodeId
  ) || nodes.find((n) => groupB.includes(n.nodeId));
  if (bLeader) bLeader.proposeState('partition-b-root', 'partition-b-mmr');

  await sleep(500);
  emulator.flush();
  await sleep(100);

  // ── Phase 3: heal ─────────────────────────────────────────────────────────
  emulator.healNetwork();
  await sleep(400);
  emulator.flush();
  await sleep(100);

  const checker = new ProtocolChecker();
  checker.checkAll(nodes);

  // Safety: no conflicting finalizations (group A minority shouldn't have finalized)
  const aFinalizedPartition = nodes
    .filter((n) => groupA.includes(n.nodeId))
    .some((n) => n.finalized.some((s) => s.stateRoot === 'partition-a-root'));

  const bFinalized = nodes
    .filter((n) => groupB.includes(n.nodeId))
    .some((n) => n.finalized.some((s) => s.stateRoot === 'partition-b-root'));

  if (!checker.passed()) {
    result.detail = checker.summary();
  } else if (aFinalizedPartition) {
    result.detail = 'FAIL — minority partition managed to finalize (quorum violated)';
  } else {
    result.pass   = true;
    result.detail = `PASS — minority partition did not finalize; majority${bFinalized ? ' finalized correctly' : ' ran independently'}; no safety violation`;
  }

  result.convergenceMs = Date.now() - start;
  return result;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { run };