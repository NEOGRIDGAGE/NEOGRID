module.exports = function crossClientStateEquivalenceTest(referenceClient, candidateClient, trace) {
  if (!referenceClient.getState || !candidateClient.getState) return false;
  return JSON.stringify(referenceClient.getState()) === JSON.stringify(candidateClient.getState());
};