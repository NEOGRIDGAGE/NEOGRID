module.exports = function traceReplayTest(client, trace) {
  return client.replayTrace ? client.replayTrace(trace) : true;
};