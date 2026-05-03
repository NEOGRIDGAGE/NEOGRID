#!/usr/bin/env node
'use strict';

const { run: singleLeaderFailure } = require('./scenarios/singleLeaderFailure');
const { run: networkPartition } = require('./scenarios/networkPartition');
const { run: equivocationAttack } = require('./scenarios/equivocationAttack');
const { run: delayedFinality } = require('./scenarios/delayedFinality');
const { ModelChecker } = require('./formal/modelChecker');

const runMode = process.env.RUN_MODE || 'small';
const iterations = Number(process.env.ITERATIONS || (runMode === 'large' ? 20 : runMode === 'medium' ? 30 : 20));
const nodeCount = Number(process.env.NODE_COUNT || (runMode === 'large' ? 100 : runMode === 'medium' ? 25 : 5));

const scenarios = [
  { name: 'Single Leader Failure', fn: singleLeaderFailure },
  { name: 'Network Partition', fn: networkPartition },
  { name: 'Equivocation Attack', fn: equivocationAttack },
  { name: 'Delayed Finality', fn: delayedFinality },
];

function histogramSummary(hist) {
  const keys = Object.keys(hist).map(Number).sort((a, b) => a - b);
  return keys.map((k) => `${k * 100}-${k * 100 + 99}ms:${hist[k]}`).join(' | ');
}

async function main() {
  console.log(`\nNDAP Advanced Validation System v2`);
  console.log(`runMode=${runMode} iterations=${iterations} nodeCount=${nodeCount}\n`);

  const modelChecker = new ModelChecker();
  const results = [];

  for (const scenario of scenarios) {
    const result = await scenario.fn({ iterations, nodeCount, runMode });
    const trace = result.worstCasePathTrace || [];
    const model = modelChecker.simulate(Array.isArray(trace) ? trace : []);
    results.push({ ...result, model });
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${scenario.name}`);
    console.log(`  safety=${result.safety} resilienceScore=${result.resilienceScore} convergenceStability=${result.convergenceStability} adversarialResistance=${result.adversarialResistance}`);
    console.log(`  successRate=${result.successRate}% finalitySuccessRate=${result.finalitySuccessRate}%`);
    console.log(`  failures=${JSON.stringify(result.failureDistribution)}`);
    console.log(`  histogram=${histogramSummary(result.convergenceHistogram || {})}`);
    if (!model.ok) {
      console.log('  model-checker-counterexample:');
      console.log(modelChecker.explain(model));
    }
  }

  const aggregate = results.reduce((acc, r) => {
    acc.pass += r.pass ? 1 : 0;
    acc.fail += r.pass ? 0 : 1;
    acc.resilience += r.resilienceScore || 0;
    acc.stability += r.convergenceStability || 0;
    acc.adversarial += r.adversarialResistance || 0;
    return acc;
  }, { pass: 0, fail: 0, resilience: 0, stability: 0, adversarial: 0 });

  console.log('\nSummary');
  console.log(`  scenariosPassed=${aggregate.pass}/${results.length}`);
  console.log(`  averageResilience=${Math.round(aggregate.resilience / results.length)}`);
  console.log(`  averageConvergenceStability=${Math.round(aggregate.stability / results.length)}`);
  console.log(`  averageAdversarialResistance=${Math.round(aggregate.adversarial / results.length)}`);
  console.log(`  overall=${aggregate.fail === 0 ? 'PASS' : 'FAIL'}`);

  process.exit(aggregate.fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});