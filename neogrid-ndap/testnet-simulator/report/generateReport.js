function generateReport({ runs = [], scenario, summary = {}, worstCaseTrace = [] } = {}) {
  return {
    title: 'NDAP SIMULATION REPORT v3',
    scenarioSummary: scenario,
    resilienceScores: summary,
    invariantViolations: summary.invariantViolations || 0,
    worstCaseRunTrace: worstCaseTrace,
    passFailClassification: summary.safety || 'FAIL',
    runs,
  };
}

module.exports = { generateReport };