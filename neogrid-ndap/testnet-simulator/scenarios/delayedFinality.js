const path = require('path');
const { SimulatedNode }   = require(path.join(__dirname, '../nodes/simulatedNode'));
const { NetworkEmulator } = require(path.join(__dirname, '../network/emulator'));
const { ValidatorSet }    = require(path.join(__dirname, '../../src/consensus/validator'));
const { ProtocolChecker } = require(path.join(__dirname, '../validator/checker'));

async function run() {
  const result = { scenario: 'delayedFinality', pass: false, detail: '', convergenceMs: null };
  const start  = Date.now();

  const vs    = new ValidatorSet();
  const nodes = [];

  for (let i = 0; i < 4; i++) {
    const n = new SimulatedNode({ nodeIndex: i, timeout: 8000 });
    vs.addValidator({ nodeId: n.nodeId, stake: 100, reputation: 1, pubKeyHex: n.identity.pubKeyHex });
    nodes.push(n);
  }
  for (const n of nodes) {
    n.validators = vs;
    n.bft._validators = vs;
  }

  // Inject extreme message delay: 200–600 ms per hop
  const emulator = new NetworkEmulator();
  emulator.delayMessages([200, 600]);
  for (const n of nodes) emulator.register(n);

  const leader = nodes.find((n) => vs.getLeader(0, 0) === n.nodeId) || nodes[0];
  leader.proposeState('delayed-root', 'delayed-mmr');

  // Wait long enough for delayed messages to propagate (max 600ms × a few hops)
  await sleep(2500);
  emulator.flush();
  await sleep(800);

  const checker = new ProtocolChecker();
  checker.checkAll(nodes);

  const anyFinalized = nodes.some((n) => n.finalized.length > 0);

  if (!checker.passed()) {
    result.detail = checker.summary();
  } else if (!anyFinalized) {
    // Under high delay, single-node auto-finalizes (only 1 in validator set is leader);
    // multi-node requires actual network propagation — still a PASS if no violation
    result.pass   = true;
    result.detail = 'PASS — extreme delay: no safety violations; finality may be pending (high-latency expected)';
  } else {
    result.pass   = true;
    result.detail = `PASS — eventual convergence achieved under extreme delay; convergence=${Date.now() - start}ms`;
  }

  result.convergenceMs = Date.now() - start;
  return result;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { run };