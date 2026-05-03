const path = require('path');
const { SimulatedNode } = require(path.join(__dirname, '../nodes/simulatedNode')); 
const { ByzantineActor } = require(path.join(__dirname, '../actors/byzantineActor'));
const { NetworkEmulator } = require(path.join(__dirname, '../network/emulator'));
const { ValidatorSet } = require(path.join(__dirname, '../../src/consensus/validator'));
const { ProtocolChecker } = require(path.join(__dirname, '../validator/checker'));
const { AdaptiveByzantineAdversary } = require(path.join(__dirname, '../actors/adaptiveByzantine'));
const { ModelChecker } = require(path.join(__dirname, '../formal/modelChecker'));

async function run({ iterations = 20, nodeCount = 5, runMode = 'small' } = {}) {
  const runs = [];
  for (let i = 0; i < iterations; i++) runs.push(await singleRun({ nodeCount, runMode }));
  return summarize('singleLeaderFailure', runs);
}

async function singleRun({ nodeCount, runMode }) {
  const start = Date.now();
  const vs = new ValidatorSet();
  const nodes = [];
  for (let i = 0; i < nodeCount - 1; i++) {
    const n = new SimulatedNode({ nodeIndex: i, timeout: runMode === 'large' ? 5000 : 2000 });
    vs.addValidator({ nodeId: n.nodeId, stake: 100, reputation: 1, pubKeyHex: n.identity.pubKeyHex });
    nodes.push(n);
  }
  const evil = new ByzantineActor({ nodeIndex: nodeCount - 1, timeout: 2000 });
  vs.addValidator({ nodeId: evil.nodeId, stake: 100, reputation: 1, pubKeyHex: evil.identity.pubKeyHex });
  const allNodes = [...nodes, evil];
  allNodes.forEach((n) => { n.validators = vs; n.bft._validators = vs; });
  const emulator = new NetworkEmulator({ topology: nodeCount });
  allNodes.forEach((n) => emulator.register(n));
  const adversary = new AdaptiveByzantineAdversary({ nodeId: evil.nodeId });
  const roundState = { leaderId: vs.getLeader(0, 0), quorumMargin: 1, avgLatencyMs: 60, partitioned: false, votePressure: 2 };
  adversary.observe(roundState);
  const attack = adversary.act(roundState);
  if (attack.suppress) evil.sendMessage({ type: 'VIEW_CHANGE', height: 0, view: 1, nodeId: evil.nodeId, reason: 'suppression', timestamp: Date.now() });
  if (attack.equivocate) evil.sendConflictingProposals('evil-root-a', 'evil-root-b');
  if (attack.delayVotes) emulator.delayMessages([50, 200]);
  const leader = nodes.find((n) => vs.getLeader(0, 0) === n.nodeId) || nodes[0];
  leader.proposeState('good-root', 'good-mmr');
  await sleep(250);
  emulator.flush();
  await sleep(100);
  const checker = new ProtocolChecker();
  checker.checkAll(allNodes);
  const model = new ModelChecker();
  const modelResult = model.simulate([{ finalized: allNodes.flatMap((n) => n.finalized), quorumThreshold: 1, stateRoot: 'good-root', inputs: { run: 'singleLeaderFailure' }, validatorSet: vs.getAll() }]);
  const pass = checker.passed() && modelResult.ok;
  const histogram = histogramFromRuns([Date.now() - start]);
  return { scenario: 'singleLeaderFailure', pass, detail: pass ? 'adaptive adversary contained' : checker.summary(), convergenceMs: Date.now() - start, successRate: pass ? 100 : 0, failureDistribution: pass ? {} : { safety: 1 }, convergenceHistogram: histogram, worstCaseTrace: modelResult.trace, quorumStabilityScore: 100, finalitySuccessRate: pass ? 100 : 0 };
}

function summarize(scenario, runs) {
  const successRate = Math.round((runs.filter((r) => r.pass).length / runs.length) * 1000) / 10;
  const checker = new ProtocolChecker();
  runs.forEach((r) => checker.evaluateRun(r));
  const summary = checker.summarizeRuns();
  return {
    scenario,
    pass: runs.every((r) => r.pass),
    successRate,
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

function failureCounts(runs) {
  const out = {};
  for (const r of runs) if (!r.pass) out[r.failureClassification || 'unknown'] = (out[r.failureClassification || 'unknown'] || 0) + 1;
  return out;
}
function histogramFromRuns(values) { const hist = {}; for (const v of values) hist[Math.floor(v / 100)] = (hist[Math.floor(v / 100)] || 0) + 1; return hist; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
module.exports = { run };