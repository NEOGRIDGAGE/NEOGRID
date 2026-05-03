const SafetyInvariant = '∀ height: not exists (stateA != stateB where both finalized)';
const LivenessInvariant = '∃ t: all honest nodes eventually reach FINALIZED state';
const DeterminismInvariant = 'identical event logs → identical final state';
const QuorumInvariant = 'finalize only if sum(votes) ≥ 2/3 total weight';

module.exports = { SafetyInvariant, LivenessInvariant, DeterminismInvariant, QuorumInvariant };