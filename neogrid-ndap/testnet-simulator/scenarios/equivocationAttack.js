const path = require('path');
const { SimulatedNode } = require(path.join(__dirname, '../nodes/simulatedNode'));
const { ByzantineActor } = require(path.join(__dirname, '../actors/byzantineActor'));
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
  return aggregate('equivocationAttack', runs, summary);
}

async function singleRun({ nodeCount }) {
  const start = Date.now();
  const vs = new ValidatorSet();
  const honest = [];
  for (let i = 0; i < nodeCount - 1; i++) {
    const n = new SimulatedNode({ nodeIndex: i, timeout: 3000 });
    vs.addValidator({ nodeId: n.nodeId, stake: 100, reputation: 1, pubKeyHex: n.identity.pubKeyHex });
    honest.push(n);
  }
  const evil = new ByzantineActor({ nodeIndex: nodeCount - 1, timeout: 3000 });
  vs.addValidator({ nodeId: evil.nodeId, stake: 100, reputation: 1, pubKeyHex: evil.identity.pubKeyHex });
  const all = [...honest, evil];
  all.forEach((n) => { n.validators = vs; n.bft._validators = vs; });
  const emulator = new NetworkEmulator({ topology: nodeCount });
  all.forEach((n) => emulator.register(n));
  const adversary = new AdaptiveByzantineAdversary({ nodeId: evil.nodeId });
  adversary.observe({ leaderId: vs.getLeader(0, 0), quorumMargin: 1, avgLatencyMs: 120, partitioned: false, votePressure: 3 });
  evil.doubleVote('honest-root', 'evil-root');
  const leader = honest.find((n) => vs.getLeader(0, 0) === n.nodeId) || honest[0];
  leader.proposeState('honest-root', 'honest-mmr');
  await sleep(300);
  emulator.flush();
  const checker = new ProtocolChecker();
  checker.checkAll(all);
  const pass = checker.passed();
  return { scenario: 'equivocationAttack', pass, detail: pass ? 'equivocation contained' : checker.summary(), convergenceMs: Date.now() - start, failureClassification: pass ? null : 'safety', worstCaseTrace: all.flatMap((n) => n.getLog()) };
}

function aggregate(scenario, runs, summary) {
  return { scenario, pass: runs.every((r) => r.pass), successRate: Math.round((runs.filter((r) => r.pass).length / runs.length) * 1000) / 10, failureDistribution: failureCounts(runs), convergenceHistogram: histogramFromRuns(runs.map((r) => r.convergenceMs || 0)), worstCasePathTrace: runs.reduce((a, b) => (a.convergenceMs || 0) > (b.convergenceMs || 0) ? a : b, runs[0]).worstCaseTrace || [], quorumStabilityScore: summary.convergenceStability, finalitySuccessRate: summary.finalitySuccessRate, failureClassification: summary.failureClassification, resilienceScore: summary.resilienceScore, convergenceStability: summary.convergenceStability, adversarialResistance: summary.adversarialResistance, safety: summary.safety, runs };
}
function failureCounts(runs) { const out = {}; for (const r of runs) if (!r.pass) out[r.failureClassification || 'unknown'] = (out[r.failureClassification || 'unknown'] || 0) + 1; return out; }
function histogramFromRuns(values) { const hist = {}; for (const v of values) hist[Math.floor(v / 100)] = (hist[Math.floor(v / 100)] || 0) + 1; return hist; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
module.exports = { run };