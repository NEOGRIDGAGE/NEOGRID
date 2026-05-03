function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextState(state, event) {
  const s = clone(state);
  switch (event.type) {
    case 'PROPOSE':
      s.view = s.view || 0;
      s.lastEvent = 'PROPOSE';
      break;
    case 'PREVOTE':
      s.lastEvent = 'PREVOTE';
      break;
    case 'PRECOMMIT':
      s.lastEvent = 'PRECOMMIT';
      break;
    case 'FINALIZE':
      s.finalizedStateRoot = event.stateRoot || s.finalizedStateRoot;
      s.lastEvent = 'FINALIZE';
      break;
    case 'TIMEOUT':
      s.view = (s.view || 0) + 1;
      s.lastEvent = 'TIMEOUT';
      break;
    case 'VIEW_CHANGE':
      s.view = event.view != null ? event.view : (s.view || 0) + 1;
      s.lastEvent = 'VIEW_CHANGE';
      break;
    default:
      break;
  }
  if (event.height != null) s.height = event.height;
  if (event.smtRoot != null) s.smtRoot = event.smtRoot;
  if (event.mmrRoot != null) s.mmrRoot = event.mmrRoot;
  if (event.validatorSet != null) s.validatorSet = clone(event.validatorSet);
  return s;
}

module.exports = { nextState };