#!/usr/bin/env node
'use strict';

const { run: singleLeaderFailure } = require('./scenarios/singleLeaderFailure');
const { run: networkPartition }    = require('./scenarios/networkPartition');
const { run: equivocationAttack }  = require('./scenarios/equivocationAttack');
const { run: delayedFinality }     = require('./scenarios/delayedFinality');

const scenarios = [
  { name: 'Single Leader Failure',  fn: singleLeaderFailure },
  { name: 'Network Partition',      fn: networkPartition    },
  { name: 'Equivocation Attack',    fn: equivocationAttack  },
  { name: 'Delayed Finality',       fn: delayedFinality     },
];

const PAD = 30;

function bar(len = 60, ch = '─') { return ch.repeat(len); }

async function main() {
  console.log('\n' + bar(60, '═'));
  console.log('  NDAP Byzantine Testnet Simulator');
  console.log(bar(60, '═'));
  console.log();

  const results  = [];
  const overall  = { pass: 0, fail: 0 };

  for (const { name, fn } of scenarios) {
    process.stdout.write(`  Running: ${name.padEnd(PAD)} `);
    let r;
    try {
      r = await fn();
    } catch (err) {
      r = { scenario: name, pass: false, detail: `UNCAUGHT: ${err.message}`, convergenceMs: null };
    }
    const tag = r.pass ? '✔ PASS' : '✘ FAIL';
    const ms  = r.convergenceMs != null ? `${r.convergenceMs}ms` : 'n/a';
    console.log(`${tag}   (${ms})`);
    console.log(`         ${r.detail}`);
    results.push(r);
    if (r.pass) overall.pass++; else overall.fail++;
  }

  console.log();
  console.log(bar(60, '─'));
  console.log(`  Results: ${overall.pass} passed, ${overall.fail} failed`);
  console.log(bar(60, '─'));

  if (overall.fail === 0) {
    console.log('\n  ✔ NDAP survived all adversarial conditions.\n');
    process.exit(0);
  } else {
    console.log('\n  ✘ One or more safety invariants were broken.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});