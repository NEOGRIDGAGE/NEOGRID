#!/usr/bin/env node
'use strict';

const { run: singleLeaderFailure } = require('./scenarios/singleLeaderFailure');
const { run: networkPartition } = require('./scenarios/networkPartition');
const { run: equivocationAttack } = require('./scenarios/equivocationAttack');
const { run: delayedFinality } = require('./scenarios/delayedFinality');
const { listScenarios } = require('./scenarios/scenarioRegistry');
const config = require('./core/simulatorConfig');
const { resilienceScore, mean, variance } = require('./metrics/resilienceScore');
const { classifyFailure } = require('./analysis/failureClassifier');
const { generateReport } = require('./report/generateReport');
const { ModelChecker } = require('./formal/modelChecker');
const { verifyTrace } = require('../core/formal/traceVerifier');

const runMode = process.env.RUN_MODE || 'small';
const iterations = Number(process.env.ITERATIONS || config.defaultRunsPerScenario);
const nodeCount = Math.min(Number(process.env.NODE_COUNT || (runMode === 'large' ? 100 : runMode === 'medium' ? 25 : 5)), config.maxNodes);

const scenarios = [
  { name: 'singleLeaderFailure', fn: singleLeaderFailure },
  { name: 'networkPartition', fn: networkPartition },
  { name: 'equivocationAttack', fn: equivocationAttack },
  { name: 'delayedFinality', fn: delayedFinality },
].filter((s) => listScenarios().includes(s.name));

async function main() {
  const modelChecker = new ModelChecker();
  const outputs = [];

  for (const scenario of scenarios) {
    const result = await scenario.fn({ iterations, nodeCount, runMode });
    const trace = result.protocolTrace || result.worstCasePathTrace || [];
    const traceCheck = verifyTrace(trace);
    const model = modelChecker.simulate(Array.isArray(trace) ? trace : []);
    const values = Array.isArray(result.runs) ? result.runs.map((r) => r.convergenceMs || 0) : [];
    const convergenceStats = { mean: mean(values), variance: variance(values) };
    const invariantViolations = model.violations.length + (traceCheck === true ? 0 : 1);
    const score = resilienceScore({
      runs: result.runs || [],
      invariantViolations,
      attackSuccessRate: 1 - ((result.successRate || 0) / 100),
      convergenceTimes: values,
    });
    const failureModes = Array.from(new Set([
      ...(result.failureDistribution ? Object.keys(result.failureDistribution) : []),
      classifyFailure({ pass: result.pass, detail: result.detail }),
      ...(model.violations || []).map((v) => v.name),
      traceCheck === true ? null : 'TRACE_VERIFICATION_FAILURE',
    ].filter(Boolean)));
    const report = generateReport({
      runs: result.runs || [],
      scenario: scenario.name,
      summary: {
        safety: result.safety,
        resilienceScore: score.total,
        convergenceStats,
        failureModes,
        invariantViolations,
      },
      worstCaseTrace: trace,
    });
    outputs.push({
      scenario: scenario.name,
      nodeCount,
      runs: iterations,
      safety: result.safety,
      resilienceScore: score.total,
      convergenceStats,
      failureModes,
      invariantViolations,
      protocolTrace: trace,
      report,
    });
  }

  for (const output of outputs) {
    console.log(JSON.stringify(output));
  }

  process.exit(outputs.some((o) => o.safety === 'FAIL') ? 1 : 0);
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});