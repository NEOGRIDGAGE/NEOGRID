const path = require('path');
const { SimulatedNode } = require(path.join(__dirname, '../nodes/simulatedNode'));
const { NetworkEmulator } = require(path.join(__dirname, '../network/emulator'));
const { ValidatorSet } = require(path.join(__dirname, '../../src/consensus/validator'));
const { ProtocolChecker } = require(path.join(__dirname, '../validator/checker'));
const { AdaptiveByzantineAdversary } = require(path.join(__dirname, '../actors/adaptiveByzantine'));

async function run({ iterations = 20, nodeCount = 25, runMode = 'medium' } = {}) {
  const runs = [];
  for (let i = 0; i < iterations; i++) runs.push(await singleRun({ nodeCount, runMode }));
  const checker = new ProtocolChecker();
  runs.forEach((r) => checker.evaluateRun(r));
  const summary = checker.summarizeRuns();
  return {
    scenario: 'delayedFinality',
    pass: runs.every((r) => r.pass),
    successRate: Math.round((runs.filter((r) => r.pass).length / runs.length) * 1000) / 10,
    failureDistribution: failureCounts(runs),
    convergenceHistogram: histogramFromRuns(runs.map((r) => r.convergenceMs || 0)),
    worstCasePathTrace: runs.reduce((a, b) => (a.convergenceMs || 0) > (b.convergenceMs || 0) ? a : b, runs[0]).worstCaseTrace || [],
    quorumStabilityScore: summary.convergenceStability,
    finalitySuccessRate: summary.finalitySuccessRate,
    failureClassification: summary.failureClassification,
    resilienceScore: summary.resilienceScore,
    convergenceStability: summary.convergenceStability,
    adversarialResistance: summary.adversarialResistance,
    safety: summary.safety,
    runs,
  };
}

async function singleRun({ nodeCount }) {
  const start = Date.now();
  const vs = new ValidatorSet();
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    const n = new SimulatedNode({ nodeIndex: i, timeout: 8000 });
    vs.addValidator({ nodeId: n.nodeId, stake: 100, reputation: 1, pubKeyHex: n.identity.pubKeyHex });
    nodes.push(n);
  }
  nodes.forEach((n) => { n.validators = vs; n.bft._validators = vs; });
  const emulator = new NetworkEmulator({ topology: nodeCount });
  emulator.delayMessages([200, 600]);
  emulator.dropMessages(0.08);
  nodes.forEach((n) => emulator.register(n));
  const adversary = new AdaptiveByzantineAdversary({ nodeId: nodes[0].nodeId, seed: 4 });
  const leader = nodes.find((n) => vs.getLeader(0, 0) === n.nodeId) || nodes[0];
  leader.proposeState('delayed-root', 'delayed-mmr');
  await sleep(1800);
  emulator.flush();
  await sleep(800);
  const checker = new ProtocolChecker();
  checker.checkAll(nodes);
  const pass = checker.passed();
  return { scenario: 'delayedFinality', pass, detail: pass ? 'eventual convergence under delay' : checker.summary(), convergenceMs: Date.now() - start, failureClassification: pass ? null : 'stability', worstCaseTrace: nodes.flatMap((n) => n.getLog()) };
}

function failureCounts(runs) { const out = {}; for (const r of runs) if (!r.pass) out[r.failureClassification || 'unknown'] = (out[r.failureClassification || 'unknown'] || 0) + 1; return out; }
function histogramFromRuns(values) { const hist = {}; for (const v of values) hist[Math.floor(v / 100)] = (hist[Math.floor(v / 100)] || 0) + 1; return hist; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
module.exports = { run };