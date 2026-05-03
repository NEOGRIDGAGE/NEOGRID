use crate::hash::sha256_hex;
use crate::smt::{SparseMerkleTree, InclusionProof};
use crate::tx::Transaction;

pub struct Verifier;

impl Verifier {
    pub fn verify_inclusion_proof(proof: &InclusionProof) -> bool {
        SparseMerkleTree::verify_proof(proof)
    }

    pub fn verify_state_root_binding(state_root: &str, smt: &SparseMerkleTree) -> bool {
        smt.compute_root() == state_root
    }

    pub fn verify_tx_hash(tx: &Transaction, expected_hash: &str) -> bool {
        tx.fingerprint() == expected_hash
    }

    pub fn verify_log_monotonic(roots: &[String]) -> bool {
        if roots.len() < 2 { return true; }
        let unique: std::collections::HashSet<_> = roots.iter().collect();
        unique.len() == roots.len()
    }

    pub fn verify_no_double_spend(nonces: &[String]) -> bool {
        let unique: std::collections::HashSet<_> = nonces.iter().collect();
        unique.len() == nonces.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_inclusion_proof() {
        let mut smt = SparseMerkleTree::new();
        let key = sha256_hex(b"test-key");
        smt.set(&key, "test-value");
        let proof = smt.get_proof(&key);
        assert!(Verifier::verify_inclusion_proof(&proof));
    }

    #[test]
    fn test_log_monotonic() {
        let roots = vec!["a".to_string(), "b".to_string(), "c".to_string()];
        assert!(Verifier::verify_log_monotonic(&roots));
        let dupes = vec!["a".to_string(), "a".to_string()];
        assert!(!Verifier::verify_log_monotonic(&dupes));
    }

    #[test]
    fn test_no_double_spend() {
        let nonces = vec!["n1".to_string(), "n2".to_string(), "n3".to_string()];
        assert!(Verifier::verify_no_double_spend(&nonces));
        let replay = vec!["n1".to_string(), "n1".to_string()];
        assert!(!Verifier::verify_no_double_spend(&replay));
    }
}
