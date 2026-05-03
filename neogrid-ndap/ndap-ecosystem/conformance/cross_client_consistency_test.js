module.exports = function crossClientConsistencyTest(referenceClient, candidateClient) {
  if (!referenceClient || !candidateClient) return false;
  return JSON.stringify(referenceClient.getState()) === JSON.stringify(candidateClient.getState());
};