const registry = {
  singleLeaderFailure: require('./singleLeaderFailure'),
  networkPartition: require('./networkPartition'),
  equivocationAttack: require('./equivocationAttack'),
  delayedFinality: require('./delayedFinality'),
};

function listScenarios() {
  return Object.keys(registry);
}

function getScenario(name) {
  return registry[name] || null;
}

module.exports = { listScenarios, getScenario };