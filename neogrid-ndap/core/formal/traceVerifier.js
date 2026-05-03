const { nextState } = require('./stateTransition');

function verifyTrace(trace) {
  if (!Array.isArray(trace)) return false;
  let state = null;
  for (let i = 0; i < trace.length; i++) {
    const step = trace[i];
    if (!step || !step.event) return i;
    if (state === null) state = step.stateBefore;
    const computed = nextState(state, step.event);
    if (JSON.stringify(computed) !== JSON.stringify(step.stateAfter)) return i;
    state = step.stateAfter;
  }
  return true;
}

module.exports = { verifyTrace };