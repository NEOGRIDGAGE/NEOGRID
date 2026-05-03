function createTrace() {
  return [];
}

function appendTrace(trace, step) {
  trace.push({
    round: step.round,
    event: step.event,
    stateBefore: step.stateBefore,
    stateAfter: step.stateAfter,
    signatures: step.signatures || [],
  });
  return trace;
}

module.exports = { createTrace, appendTrace };