const path = require('path');
const { SimulatedNode }   = require(path.join(__dirname, '../nodes/simulatedNode'));
const { ByzantineActor }  = require(path.join(__dirname, '../actors/byzantineActor'));
const { NetworkEmulator } = require(path.join(__dirname, '../network/emulator'));
const { ValidatorSet }    = require(path.join(__dirname, '../../src/consensus/validator'));
const { ProtocolChecker } = require(path.join(__dirname, '../validator/checker'));

async function run() {
  const result = { scenario: 'equivocationAttack', pass: false, detail: '', convergenceMs: null };
  const start  = Date.now();

  const vs     = new ValidatorSet();
  const honest = [];
  for (let i = 0; i < 4; i++) {
    const n = new SimulatedNode({ nodeIndex: i, timeout: 2000 });
    vs.addValidator({ nodeId: n.nodeId, stake: 100, reputation: 1, pubKeyHex: n.identity.pubKeyHex });
    honest.push(n);
  }

  // 1 byzantine validator that double-votes
  const evil = new ByzantineActor({ nodeIndex: 4, timeout: 2000 });
  vs.addValidator({ nodeId: evil.nodeId, stake: 100, reputation: 1, pubKeyHex: evil.identity.pubKeyHex });

  const allNodes = [...honest, evil];
  for (const n of allNodes) {
    n.validators = vs;
    n.bft._validators = vs;
  }

  const emulator = new NetworkEmulator();
  for (const n of allNodes) emulator.register(n);

  // Honest leader proposes
  const leader = honest.find((n) => vs.getLeader(0, 0) === n.nodeId) || honest[0];
  leader.proposeState('honest-root', 'honest-mmr');

  await sleep(100);

  // Byzantine actor double-votes for two different roots
  evil.doubleVote('honest-root', 'evil-equivocation-root');

  await sleep(400);
  emulator.flush();
  await sleep(100);

  const checker = new ProtocolChecker();
  checker.checkAll(allNodes);

  // No honest node should finalize the evil equivocation root
  const evilAccepted = honest.some((n) =>
    n.finalized.some((s) => s.stateRoot === 'evil-equivocation-root')
  );

  if (evilAccepted) {
    result.detail = 'FAIL — equivocation vote caused honest node to finalize fabricated root';
  } else if (!checker.passed()) {
    result.detail = checker.summary();
  } else {
    result.pass   = true;
    result.detail = 'PASS — double-vote equivocation rejected; honest root uncontaminated';
  }

  result.convergenceMs = Date.now() - start;
  return result;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

module.exports = { run };