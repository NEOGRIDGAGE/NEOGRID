function classifyFailure(result) {
  if (!result || result.pass) return null;
  const detail = String(result.detail || '').toLowerCase();
  if (detail.includes('double finalization') || detail.includes('safety')) return 'SAFETY_VIOLATION';
  if (detail.includes('no convergence') || detail.includes('liveness')) return 'LIVENESS_FAILURE';
  if (detail.includes('delay') || detail.includes('latency') || detail.includes('stability')) return 'NETWORK_DEGRADATION';
  if (detail.includes('byzantine') || detail.includes('equivocation') || detail.includes('attack')) return 'BYZANTINE_SUCCESS';
  return 'NETWORK_DEGRADATION';
}

module.exports = { classifyFailure };