module.exports = function traceReplayTest(client, reference, trace) {
  if (!client || !reference) return false;
  const clientResult = client.applyEvent ? trace.reduce((state, event) => client.applyEvent(event, state), client.getState ? client.getState() : undefined) : null;
  const referenceResult = reference.applyEvent ? trace.reduce((state, event) => reference.applyEvent(event, state), reference.getState ? reference.getState() : undefined) : null;
  return JSON.stringify(clientResult) === JSON.stringify(referenceResult);
};