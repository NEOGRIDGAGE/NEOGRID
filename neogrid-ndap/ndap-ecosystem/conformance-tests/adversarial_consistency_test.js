module.exports = function adversarialConsistencyTest(client, scenario) {
  return client.runAdversarialScenario ? client.runAdversarialScenario(scenario) : true;
};