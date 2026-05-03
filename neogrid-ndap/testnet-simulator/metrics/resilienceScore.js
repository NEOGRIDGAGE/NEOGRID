function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function variance(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((sum, v) => sum + ((v - m) ** 2), 0) / values.length;
}

function resilienceScore({ runs = [], invariantViolations = 0, attackSuccessRate = 0, convergenceTimes = [] } = {}) {
  const total = runs.length || 1;
  const passRate = runs.filter((r) => r.pass).length / total;
  const safetyScore = clamp(Math.round((passRate * 40) - (invariantViolations * 2)), 0, 40);
  const convergenceVariance = variance(convergenceTimes);
  const stabilityScore = clamp(Math.round(30 - Math.min(30, convergenceVariance / 1000)), 0, 30);
  const adversarialResistanceScore = clamp(Math.round(30 - (attackSuccessRate * 30)), 0, 30);
  return {
    total: clamp(safetyScore + stabilityScore + adversarialResistanceScore, 0, 100),
    safetyScore,
    stabilityScore,
    adversarialResistanceScore,
    convergenceVariance,
  };
}

module.exports = { resilienceScore, mean, variance };