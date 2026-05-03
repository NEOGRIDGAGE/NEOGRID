const assert = require('assert');

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failed++;
    failures.push({ name, message: err.message });
  }
}

async function suite(name, fn) {
  console.log(`\n[ ${name} ]`);
  await fn();
}

async function main() {
  console.log('=== NDAP ENTERPRISE TEST SUITE ===\n');

  await require('./smt.test')(test, suite, assert);
  await require('./mmr.test')(test, suite, assert);
  await require('./tx.test')(test, suite, assert);
  await require('./ipfs.test')(test, suite, assert);
  await require('./engine.test')(test, suite, assert);
  await require('./zk.test')(test, suite, assert);

  console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.message}`));
    process.exit(1);
  } else {
    console.log('All tests passed.');
    process.exit(0);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
